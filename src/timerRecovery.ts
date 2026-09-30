import {
  ACTIVE_TIMER_STORAGE_KEY,
  initialTimerState,
  normalizeTimerState,
  closeRunningInterval,
  timerStateAt,
  restoreExpiredTimer,
  type TimerState,
} from "./timerState";

type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The existing recovery key holds active and Finished-but-unsaved Timer state. */
export function readTimerRecovery(storage: RecoveryStorage = localStorage): TimerState {
  try {
    const raw = storage.getItem(ACTIVE_TIMER_STORAGE_KEY);
    return raw ? normalizeTimerState(JSON.parse(raw)) : initialTimerState;
  } catch {
    return initialTimerState;
  }
}

export function persistTimerRecovery(state: TimerState, storage: RecoveryStorage = localStorage) {
  if (state.running) storage.setItem(ACTIVE_TIMER_STORAGE_KEY, JSON.stringify(state));
  else storage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
}

/** Snapshot exact focus without changing the live running interval or countdown deadline. */
export function checkpointTimerState(state: TimerState, now = Date.now()): TimerState {
  if (!state.running) return state;
  const snapshot = timerStateAt(state, now);
  const closed = closeRunningInterval(snapshot, now);
  return {
    ...snapshot,
    checkpointAt: now,
    checkpointRemainingSeconds: snapshot.remainingSeconds,
    checkpointFocusedSeconds: closed.accumulatedFocusedSeconds,
    checkpointIntervals: closed.focusIntervals,
  };
}

export function continueTimerRecovery(state: TimerState, now = Date.now()): TimerState {
  return checkpointTimerState(restoreExpiredTimer(timerStateAt(state, now), now), now);
}

export function resumeTimerCheckpoint(state: TimerState, now = Date.now()): TimerState {
  if (!state.running || state.paused || state.finished) return state;
  const exhausted = state.mode !== "stopwatch" && state.checkpointRemainingSeconds <= 0;
  return checkpointTimerState(
    {
      ...state,
      paused: false,
      finished: exhausted,
      finishedAt: exhausted ? (state.targetEnd ?? state.checkpointAt) : null,
      remainingSeconds: state.checkpointRemainingSeconds,
      accumulatedFocusedSeconds: state.checkpointFocusedSeconds,
      focusIntervals: state.checkpointIntervals,
      runningSince: exhausted ? null : now,
      targetEnd: exhausted || state.mode === "stopwatch" ? null : now + state.checkpointRemainingSeconds * 1000,
    },
    now,
  );
}

/** One main-window loop, anchored to Start/Resume even if the hook mounts later. */
export function scheduleRecoveryCheckpoints(read: () => TimerState, write: (state: TimerState) => void) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const schedule = () => {
    const state = read();
    if (stopped || !state.running || state.paused || state.finished || state.runningSince === null) return;
    const anchor = state.runningSince;
    const last = Math.max(anchor, state.checkpointAt ?? anchor);
    const next = anchor + (Math.floor((last - anchor) / 60000) + 1) * 60000;
    timeout = setTimeout(
      () => {
        const current = read();
        if (stopped || !current.running || current.paused || current.finished || current.runningSince === null) return;
        write(checkpointTimerState(current));
        schedule();
      },
      Math.max(0, next - Date.now()),
    );
  };
  schedule();
  return () => {
    stopped = true;
    clearTimeout(timeout);
  };
}

let closeCheckpoint: (() => void) | undefined;
export function registerCloseCheckpoint(write: () => void) {
  closeCheckpoint = write;
  return () => {
    if (closeCheckpoint === write) closeCheckpoint = undefined;
  };
}

/** Called only after the frontend accepts a close request, never on Cancel. */
export async function closeAfterCheckpoint(exit: () => Promise<unknown>) {
  closeCheckpoint?.();
  await exit();
}
