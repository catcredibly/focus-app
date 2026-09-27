use std::sync::{Mutex, MutexGuard};
use tauri::{Emitter, Manager};

#[derive(Default)]
pub struct PopoutLifecycle(pub Mutex<PopoutState>);

#[derive(Default)]
pub struct PopoutState {
    pub session_id: Option<String>,
    pub deadline: Option<u64>,
    pub requested: bool,
    pub generation: u64,
    pub reveal_sequence: u64,
    pub shortcut_reveal: Option<u64>,
    pub pointer_inside: bool,
}

impl PopoutState {
    pub fn cancel_shortcut_reveal(&mut self) {
        self.reveal_sequence = self.reveal_sequence.wrapping_add(1);
        self.shortcut_reveal = None;
    }
    fn accepts_timeout(&self, generation: u64, sequence: u64) -> bool {
        self.allows(generation) && !self.pointer_inside && self.shortcut_reveal == Some(sequence)
    }

    pub fn active(&self) -> bool {
        // A countdown deadline is not Session finalization. Finished Timers can extend.
        self.session_id.is_some()
    }
    pub fn allows(&self, generation: u64) -> bool {
        self.requested && self.active() && self.generation == generation
    }
}

pub fn lock(state: &PopoutLifecycle) -> Result<MutexGuard<'_, PopoutState>, String> {
    state.0.lock().map_err(|_| "Popout lifecycle unavailable".into())
}

fn hide_windows(app: &tauri::AppHandle) -> Result<(), String> {
    // Attempt every hide even if one window fails; a reveal tab must not outlive Close.
    let mut failure = None;
    for label in ["timer-menu", "timer-tab", "timer"] {
        if let Some(window) = app.get_webview_window(label) {
            if let Err(error) = window.hide() { failure = Some(error.to_string()); }
        }
    }
    let _ = app.emit("focus://popout-closed", ());
    failure.map_or(Ok(()), Err)
}

pub fn close(app: &tauri::AppHandle) -> Result<(), String> {
    let managed = app.state::<PopoutLifecycle>();
    let mut state = lock(&managed)?;
    // Visibility is transient, independent of persisted docking/auto-hide preferences.
    // Invalidate callbacks before hiding, and hold the guard through native operations.
    state.cancel_shortcut_reveal();
    state.pointer_inside = false;
    let _ = app.emit_to("main", "focus://cancel-shortcut-reveal", state.reveal_sequence);
    state.requested = false;
    state.generation = state.generation.wrapping_add(1);
    hide_windows(app)
}

#[tauri::command]
pub fn sync_popout_session(app: tauri::AppHandle, session_id: Option<String>, deadline: Option<u64>) -> Result<(), String> {
    let managed = app.state::<PopoutLifecycle>();
    let mut state = lock(&managed)?;
    let changed_session = state.session_id.is_some() && state.session_id != session_id;
    state.session_id = session_id;
    state.deadline = deadline;
    if changed_session || !state.active() {
        if state.requested || changed_session { state.generation = state.generation.wrapping_add(1); }
        state.cancel_shortcut_reveal();
        state.pointer_inside = false;
        let _ = app.emit_to("main", "focus://cancel-shortcut-reveal", state.reveal_sequence);
        state.requested = false;
        hide_windows(&app)?;
    }
    Ok(())
}

#[tauri::command]
pub fn prepare_timer_popout(app: tauri::AppHandle, session_id: Option<String>, deadline: Option<u64>) -> Result<u64, String> {
    sync_popout_session(app.clone(), session_id, deadline)?;
    let managed = app.state::<PopoutLifecycle>();
    let state = lock(&managed)?;
    Ok(state.generation)
}


#[derive(serde::Serialize)]
pub struct RevealTicket { generation: u64, sequence: u64 }

#[tauri::command]
pub fn arm_shortcut_reveal(app: tauri::AppHandle) -> Result<Option<RevealTicket>, String> {
    let managed = app.state::<PopoutLifecycle>();
    let mut state = lock(&managed)?;
    state.cancel_shortcut_reveal();
    if !state.requested || !state.active() || state.pointer_inside { return Ok(None); }
    if !app.get_webview_window("timer").is_some_and(|window| window.is_visible().unwrap_or(false)) { return Ok(None); }
    state.shortcut_reveal = Some(state.reveal_sequence);
    Ok(Some(RevealTicket { generation: state.generation, sequence: state.reveal_sequence }))
}

#[tauri::command]
pub fn interact_with_shortcut_reveal(app: tauri::AppHandle, inside: bool) -> Result<(), String> {
    let managed = app.state::<PopoutLifecycle>();
    let mut state = lock(&managed)?;
    state.pointer_inside = inside;
    if inside {
        state.cancel_shortcut_reveal();
        let _ = app.emit_to("main", "focus://cancel-shortcut-reveal", state.reveal_sequence);
    }
    Ok(())
}

#[tauri::command]
pub fn expire_shortcut_reveal(app: tauri::AppHandle, generation: u64, sequence: u64) -> Result<(), String> {
    let managed = app.state::<PopoutLifecycle>();
    let mut state = lock(&managed)?;
    if !state.accepts_timeout(generation, sequence) { return Ok(()); }
    state.cancel_shortcut_reveal();
    state.requested = false;
    state.generation = state.generation.wrapping_add(1);
    hide_windows(&app)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn closed_and_stale_generations_cannot_reveal_but_paused_sessions_can() {
        let mut state = PopoutState { session_id: Some("test".into()), deadline: None, requested: true, generation: 5, ..Default::default() };
        state.deadline = Some(1); // An elapsed deadline remains extendable.
        assert!(state.allows(5));
        assert!(!state.allows(4));
        state.requested = false;
        state.generation += 1;
        assert!(!state.allows(5));
        assert!(!state.allows(6));
        state.requested = true;
        assert!(!state.allows(5));
        assert!(state.allows(6));
        state.session_id = None;
        assert!(!state.allows(6));
    }
    #[test]
    fn pointer_close_and_new_reveal_invalidate_pending_timeout() {
        let mut state = PopoutState { session_id: Some("live".into()), requested: true, generation: 7, shortcut_reveal: Some(3), reveal_sequence: 3, ..Default::default() };
        assert!(state.accepts_timeout(7, 3));
        state.pointer_inside = true;
        state.cancel_shortcut_reveal();
        assert!(!state.accepts_timeout(7, 3));
        state.pointer_inside = false;
        state.shortcut_reveal = Some(4);
        assert!(!state.accepts_timeout(7, 3));
        assert!(state.accepts_timeout(7, 4));
        state.generation += 1;
        assert!(!state.accepts_timeout(7, 4));
    }

}
