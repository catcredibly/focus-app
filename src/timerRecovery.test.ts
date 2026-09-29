import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { FocusDatabase } from "./db";
import { readTimerRecovery, persistTimerRecovery } from "./timerRecovery";
import {
  initialTimerState,
  startStopwatchState,
  toggleTimerPause,
  finishTimerState,
  completedSession,
  idleTimerState,
} from "./timerState";
import { saveFocusSession } from "./saveFocusSession";

it("persists transitions, survives failed saves and recovers a save-before-cleanup crash without duplication", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const database = new FocusDatabase(`timer-recovery-${crypto.randomUUID()}`);
  const start = new Date(2026, 8, 21, 23).getTime();
  const subject = { id: "s", name: "S", academicYearId: "y", color: "#fff", archived: false };
  const year = { id: "y", name: "Y", archived: false };
  try {
    let state = startStopwatchState(initialTimerState, subject, year, start);
    persistTimerRecovery(state, storage);
    expect(readTimerRecovery(storage)).toEqual(state);
    state = toggleTimerPause(readTimerRecovery(storage), start + 1800000);
    persistTimerRecovery(state, storage);
    expect(readTimerRecovery(storage).paused).toBe(true);
    expect(readTimerRecovery(storage).focusIntervals).toHaveLength(1);
    state = toggleTimerPause(readTimerRecovery(storage), start + 5400000);
    persistTimerRecovery(state, storage);
    state = finishTimerState(readTimerRecovery(storage), start + 7200000);
    persistTimerRecovery(state, storage);
    expect(readTimerRecovery(storage)).toMatchObject({ finished: true, focusIntervals: state.focusIntervals });
    const session = completedSession(readTimerRecovery(storage), state.finishedAt!)!;
    await expect(saveFocusSession({ ...session, note: "x".repeat(100000) }, false, database)).rejects.toThrow();
    expect(readTimerRecovery(storage).focusIntervals).toHaveLength(2);
    await saveFocusSession(session, false, database);
    // Simulate a crash after the DB write, before recovery cleanup.
    const recovered = readTimerRecovery(storage);
    await saveFocusSession(completedSession(recovered, recovered.finishedAt!)!, false, database);
    expect(await database.sessions.count()).toBe(1);
    expect((await database.sessions.get(session.id))?.focusIntervals).toBeUndefined();
    persistTimerRecovery(idleTimerState(recovered), storage);
    expect(values.size).toBe(0);
  } finally {
    await database.delete();
  }
});
