import type { FocusSession } from "./types";

export function exactFocusIntervals(session: FocusSession) {
  const intervals = session.focusIntervals;
  if (
    Array.isArray(intervals) &&
    intervals.length &&
    intervals.every(
      (interval, index) =>
        interval &&
        typeof interval === "object" &&
        Number.isFinite(interval.startTime) &&
        Number.isFinite(interval.endTime) &&
        interval.startTime >= session.startTime &&
        interval.endTime <= session.endTime &&
        interval.endTime > interval.startTime &&
        (!index || interval.startTime >= intervals[index - 1].endTime),
    )
  ) {
    const recorded = intervals.reduce((sum, interval) => sum + (interval.endTime - interval.startTime) / 1000, 0);
    if (recorded > 0 && Math.abs(recorded - session.focusedDurationSeconds) < 1e-7) return intervals;
  }
  return undefined;
}

function allocationIntervals(session: FocusSession) {
  return session.manual === true
    ? [{ startTime: session.startTime, endTime: session.endTime }]
    : exactFocusIntervals(session);
}
export function exactFocusInRange(session: FocusSession, start: number, end: number) {
  if (end <= start) return 0;
  return (allocationIntervals(session) ?? []).reduce(
    (sum, interval) => sum + Math.max(0, Math.min(interval.endTime, end) - Math.max(interval.startTime, start)) / 1000,
    0,
  );
}
export function allocatedFocusInRange(session: FocusSession, start: number, end: number) {
  if (allocationIntervals(session)) return exactFocusInRange(session, start, end);
  // Legacy Sessions keep their stored total on their original date, without invented timing.
  return session.startTime >= start && session.startTime < end ? session.focusedDurationSeconds : 0;
}
export function dailyFocusAllocations(session: FocusSession) {
  const intervals = allocationIntervals(session);
  const days = new Map<number, { start: number; end: number; seconds: number }>();
  for (const interval of intervals ?? []) {
    if (!Number.isFinite(interval.startTime) || !Number.isFinite(interval.endTime)) continue;
    let cursor = interval.startTime;
    while (cursor < interval.endTime) {
      const date = new Date(cursor);
      date.setHours(0, 0, 0, 0);
      const start = date.getTime();
      date.setDate(date.getDate() + 1);
      const end = date.getTime();
      const part = days.get(start) ?? { start, end, seconds: 0 };
      part.seconds += (Math.min(end, interval.endTime) - cursor) / 1000;
      days.set(start, part);
      cursor = end;
    }
  }
  if (!intervals && Number.isFinite(session.startTime) && session.focusedDurationSeconds > 0) {
    const date = new Date(session.startTime);
    date.setHours(0, 0, 0, 0);
    const start = date.getTime();
    date.setDate(date.getDate() + 1);
    days.set(start, { start, end: date.getTime(), seconds: session.focusedDurationSeconds });
  }
  return [...days.values()].sort((a, b) => a.start - b.start);
}
