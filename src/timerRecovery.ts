import { ACTIVE_TIMER_STORAGE_KEY, initialTimerState, normalizeTimerState, type TimerState } from "./timerState";

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
