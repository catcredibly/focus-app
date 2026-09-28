//! Backend detection must use GTK's selected display, not session environment
//! variables: a Wayland session may deliberately run Shunhen through XWayland.
use gtk::prelude::*;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

static POSITIONING: AtomicBool = AtomicBool::new(false);
pub fn supports_positioning() -> bool { POSITIONING.load(Ordering::Relaxed) }

fn observe_monitor(monitor: &gtk::gdk::Monitor, app: tauri::AppHandle) {
    monitor.connect_notify_local(None, move |_, property| {
        if matches!(property.name(), "geometry" | "workarea" | "scale-factor") {
            let _ = app.emit_to("timer", "focus://display-geometry-changed", "linux-monitor-change");
        }
    });
}

pub fn install(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window unavailable")?.gtk_window().map_err(|e| e.to_string())?;
    let display = gtk::prelude::WidgetExt::display(&window);
    POSITIONING.store(display.type_().name() == "GdkX11Display", Ordering::Relaxed);
    for index in 0..display.n_monitors() {
        if let Some(monitor) = display.monitor(index) { observe_monitor(&monitor, app.clone()); }
    }
    let added = app.clone();
    display.connect_monitor_added(move |_, monitor| {
        observe_monitor(monitor, added.clone());
        let _ = added.emit_to("timer", "focus://display-geometry-changed", "linux-monitor-added");
    });
    let removed = app.clone();
    display.connect_monitor_removed(move |_, _| {
        let _ = removed.emit_to("timer", "focus://display-geometry-changed", "linux-monitor-removed");
    });
    Ok(())
}
