import { afterEach, expect, it, vi } from "vitest";
import { sessionMaximumEnd, countdownCanStart, overnightAllocationValid } from "./sessionBoundary";
import {
  initialTimerState,
  startTimerState,
  startStopwatchState,
  toggleTimerPause,
  extendTimerState,
  enforceSessionBoundary,
  completedSession,
  restoreExpiredTimer,
  normalizeTimerState,
  acknowledgeSessionLimit,
  focusedSecondsAt,
  closeRunningInterval,
  idleTimerState,
} from "./timerState";
const year = { id: "y", name: "Y", archived: false },
  subject = { id: "s", name: "S", academicYearId: "y", color: "#fff", archived: false };
const start = new Date(2026, 8, 15, 23).getTime();
afterEach(() => vi.useRealTimers());
it("clears the boundary notice only when the active Session is cleared", () => {
  const active = startStopwatchState(initialTimerState, subject, year, start);
  const finished = enforceSessionBoundary(active, sessionMaximumEnd(start) + 1000);
  expect(finished.sessionLimitReached).toBe(true);
  const idle = idleTimerState(finished);
  expect(idle.sessionLimitReached).toBe(false);
  expect(idle.maximumEnd).toBeUndefined();
  expect(finished.focusIntervals?.length).toBeGreaterThan(0);
});
it("constructs the following local day's last second and validates live prospective countdown starts", () => {
  vi.useFakeTimers();
  vi.setSystemTime(start);
  const limit = sessionMaximumEnd(start);
  expect(new Date(limit).getDate()).toBe(16);
  expect(new Date(limit).toTimeString().slice(0, 8)).toBe("23:59:59");
  const duration = (limit - start) / 1000;
  expect(countdownCanStart(duration)).toBe(true);
  vi.advanceTimersByTime(1000);
  expect(countdownCanStart(duration)).toBe(false);
  vi.setSystemTime(new Date(2026, 8, 16, 0));
  expect(countdownCanStart(duration)).toBe(true);
});
it.each([false, true])(
  "finishes a stopwatch at the boundary, paused=%s, and never resumes onto a third date",
  (paused) => {
    const running = startStopwatchState(initialTimerState, subject, year, start);
    const state = paused ? toggleTimerPause(running, start + 60000) : running;
    const max = running.maximumEnd!;
    const finished = enforceSessionBoundary(state, max + 3600000);
    expect(finished).toMatchObject({ finished: true, finishedAt: max, sessionLimitReached: true, paused: false });
    expect(focusedSecondsAt(finished, max + 7200000)).toBe(paused ? 60 : (max - start) / 1000);
    expect(toggleTimerPause(finished, max + 1000)).toBe(finished);
    expect(finished.focusIntervals.every((interval) => interval.endTime <= max)).toBe(true);
    expect(restoreExpiredTimer(normalizeTimerState(JSON.parse(JSON.stringify(state))), max + 1000)).toEqual(finished);
    const acknowledged = acknowledgeSessionLimit(finished);
    expect(acknowledged).toMatchObject({
      finished: true,
      sessionLimitAcknowledged: true,
      sessionId: running.sessionId,
    });
    expect(enforceSessionBoundary(acknowledged, max + 5000)).toBe(acknowledged);
    expect(completedSession(acknowledged, max + 5000)?.endTime).toBe(max);
  },
);
it("rejects impossible countdown starts/extensions and caps delayed countdown completion", () => {
  const max = sessionMaximumEnd(start),
    duration = (max - start) / 1000;
  expect(startTimerState(initialTimerState, duration + 1, subject, year, start)).toBe(initialTimerState);
  const running = startTimerState(initialTimerState, duration, subject, year, start);
  expect(extendTimerState(running, 1, start)).toBe(running);
  const paused = toggleTimerPause(running, start + 1000);
  const resumed = toggleTimerPause(paused, start + 5000);
  expect(enforceSessionBoundary(resumed, max + 1000).finishedAt).toBe(max);
});
it("crosses the first midnight seamlessly and validates both overnight portions", () => {
  const running = startStopwatchState(initialTimerState, subject, year, start);
  expect(enforceSessionBoundary(running, start + 7200000)).toBe(running);
  expect(overnightAllocationValid(start, start + 10800000, 10800, 7200)).toBe(true);
  expect(overnightAllocationValid(start, start + 10800000, 7200, 1000)).toBe(false);
  expect(overnightAllocationValid(start, start + 10800000, 7200, 8000)).toBe(false);
  expect(overnightAllocationValid(start, start + 10800000, 7200, -1)).toBe(false);
  expect(overnightAllocationValid(start, start + 360000, 300)).toBe(true);
  expect(overnightAllocationValid(start, sessionMaximumEnd(start) + 1000, 300, 100)).toBe(false);
});

it.each([
  { pause: [], total: 10800, after: 7200 },
  { pause: [[1800, 2700]], total: 9900, after: 7200 },
  { pause: [[5400, 6300]], total: 9900, after: 6300 },
  { pause: [[2700, 4500]], total: 9000, after: 6300 },
])("summarizes overnight intervals without persisting raw pause data: %j", ({ pause, total, after }) => {
  let state = startStopwatchState(initialTimerState, subject, year, start);
  for (const [from, to] of pause) {
    state = toggleTimerPause(state, start + from * 1000);
    state = toggleTimerPause(state, start + to * 1000);
  }
  const before = JSON.stringify(state);
  const saved = completedSession(state, start + 10800000)!;
  expect(saved.focusedDurationSeconds).toBe(total);
  expect(saved.focusedAfterMidnightSeconds).toBe(after);
  expect(saved.focusIntervals).toBeUndefined();
  expect(saved.focusedDurationSeconds - saved.focusedAfterMidnightSeconds! + saved.focusedAfterMidnightSeconds!).toBe(
    total,
  );
  expect(JSON.stringify(state)).toBe(before); // Save attempt never clears recoverable intervals.
});
