import type { FocusSession } from "./types";

/** Never infer pauses. Obsolete/overlapping intervals fall back to the real interval. */
function usableIntervals(session: FocusSession) {
  const intervals = session.focusIntervals;
  const recorded = intervals?.reduce((sum, interval) => sum + (interval.endTime - interval.startTime) / 1000, 0) ?? 0;
  if (
    intervals?.length &&
    recorded > 0 &&
    (Math.abs(recorded - session.focusedDurationSeconds) <= 0.5 ||
      intervals.reduce((sum, interval) => sum + Math.round((interval.endTime - interval.startTime) / 1000), 0) ===
        session.focusedDurationSeconds) &&
    intervals.every(
      (interval, index) =>
        Number.isFinite(interval.startTime) &&
        Number.isFinite(interval.endTime) &&
        interval.startTime >= session.startTime &&
        interval.endTime <= session.endTime &&
        interval.endTime > interval.startTime &&
        (!index || interval.startTime >= intervals[index - 1].endTime),
    )
  )
    return intervals;
  return [{ startTime: session.startTime, endTime: session.endTime }];
}

export function hasUsableFocusIntervals(session: FocusSession) {
  return Boolean(session.focusIntervals?.length && usableIntervals(session) === session.focusIntervals);
}

export function removesExactFocusTiming(
  session: FocusSession,
  next: Pick<FocusSession, "startTime" | "endTime" | "focusedDurationSeconds">,
) {
  return (
    hasUsableFocusIntervals(session) &&
    (session.startTime !== next.startTime ||
      session.endTime !== next.endTime ||
      session.focusedDurationSeconds !== next.focusedDurationSeconds)
  );
}

export function allocatedFocusInRange(session: FocusSession, start: number, end: number) {
  const intervals = usableIntervals(session);
  const total = intervals.reduce((sum, interval) => sum + interval.endTime - interval.startTime, 0);
  if (!(total > 0) || !Number.isFinite(total) || !(session.focusedDurationSeconds > 0)) return 0;
  const overlap = intervals.reduce(
    (sum, interval) => sum + Math.max(0, Math.min(interval.endTime, end) - Math.max(interval.startTime, start)),
    0,
  );
  return session.focusedDurationSeconds * (overlap / total);
}

export function dailyFocusAllocations(session: FocusSession) {
  const result: { start: number; end: number; seconds: number }[] = [];
  if (
    !Number.isFinite(session.startTime) ||
    !Number.isFinite(session.endTime) ||
    !Number.isFinite(session.focusedDurationSeconds)
  )
    return result;
  const date = new Date(session.startTime);
  date.setHours(0, 0, 0, 0);
  while (date.getTime() < session.endTime) {
    const start = date.getTime();
    date.setDate(date.getDate() + 1);
    const end = date.getTime();
    const seconds = allocatedFocusInRange(session, start, end);
    if (seconds > 0) result.push({ start, end, seconds });
  }
  if (result.length) {
    // Assign arithmetic residue to the final populated day; preserve the canonical total.
    result[result.length - 1].seconds =
      session.focusedDurationSeconds - result.slice(0, -1).reduce((sum, day) => sum + day.seconds, 0);
  }
  return result;
}
