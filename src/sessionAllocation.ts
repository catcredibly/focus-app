import { followingMidnight, overnightAllocationValid, sessionMaximumEnd } from "./sessionBoundary";
import type { FocusSession } from "./types";

/** Returns recorded focus intervals only when they exactly account for focused duration. */
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
    if (session.focusedAfterMidnightSeconds !== undefined) {
      const midnight = followingMidnight(session.startTime);
      const after = intervals.reduce(
        (sum, interval) => sum + Math.max(0, interval.endTime - Math.max(interval.startTime, midnight)) / 1000,
        0,
      );
      if (Math.abs(after - session.focusedAfterMidnightSeconds) >= 1e-7) return undefined;
    }
    if (recorded > 0 && Math.abs(recorded - session.focusedDurationSeconds) < 1e-7) return intervals;
  }
  return undefined;
}

export function hasUsableFocusIntervals(session: FocusSession) {
  return Boolean(exactFocusIntervals(session));
}

export function hasExactFocusTiming(session: FocusSession) {
  const span = (session.endTime - session.startTime) / 1000;
  return (
    Boolean(exactFocusIntervals(session)) ||
    (Number.isFinite(span) && span > 0 && Math.abs(span - session.focusedDurationSeconds) < 1e-7)
  );
}

export function reconstructFocusedAfterMidnight(session: FocusSession) {
  const midnight = followingMidnight(session.startTime);
  if (session.endTime < midnight || session.endTime > sessionMaximumEnd(session.startTime)) return undefined;
  const intervals = exactFocusIntervals(session);
  if (intervals)
    return intervals.reduce(
      (sum, interval) => sum + Math.max(0, interval.endTime - Math.max(interval.startTime, midnight)) / 1000,
      0,
    );
  return undefined;
}

export function reconstructSessionFields(session: FocusSession): FocusSession {
  if (session.focusedAfterMidnightSeconds !== undefined) return session;
  const focusedAfterMidnightSeconds = reconstructFocusedAfterMidnight(session);
  return focusedAfterMidnightSeconds === undefined ? session : { ...session, focusedAfterMidnightSeconds };
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
  return dailyFocusAllocations(session).reduce((sum, day) => {
    const from = Math.max(day.start, session.startTime);
    const to = Math.min(day.end, session.endTime);
    if (start <= from && end >= to) return sum + day.seconds;
    return sum + exactFocusInRange(session, Math.max(start, from), Math.min(end, to));
  }, 0);
}

/** Intraday consumers must never manufacture pause placement. */
export function exactFocusInRange(session: FocusSession, start: number, end: number) {
  if (end <= start) return 0;
  const intervals = exactFocusIntervals(session);
  if (intervals)
    return intervals.reduce(
      (sum, interval) =>
        sum + Math.max(0, Math.min(interval.endTime, end) - Math.max(interval.startTime, start)) / 1000,
      0,
    );
  if (!hasExactFocusTiming(session)) return 0;
  return Math.max(0, Math.min(session.endTime, end) - Math.max(session.startTime, start)) / 1000;
}

export function dailyFocusAllocations(session: FocusSession) {
  if (
    !Number.isFinite(session.focusedDurationSeconds) ||
    session.focusedDurationSeconds <= 0 ||
    session.endTime <= session.startTime ||
    session.focusedDurationSeconds > (session.endTime - session.startTime) / 1000 ||
    session.endTime > sessionMaximumEnd(session.startTime)
  )
    return [];
  const midnight = followingMidnight(session.startTime);
  const focusedAfterMidnightSeconds = session.focusedAfterMidnightSeconds ?? reconstructFocusedAfterMidnight(session);
  if (
    session.endTime >= midnight &&
    overnightAllocationValid(
      session.startTime,
      session.endTime,
      session.focusedDurationSeconds,
      focusedAfterMidnightSeconds,
    )
  ) {
    const first = new Date(session.startTime);
    first.setHours(0, 0, 0, 0);
    const next = new Date(midnight);
    next.setDate(next.getDate() + 1);
    return [
      {
        start: first.getTime(),
        end: midnight,
        seconds: session.focusedDurationSeconds - focusedAfterMidnightSeconds!,
      },
      { start: midnight, end: next.getTime(), seconds: focusedAfterMidnightSeconds! },
    ].filter((part) => part.seconds > 0);
  }
  if (
    !Number.isFinite(session.startTime) ||
    !Number.isFinite(session.endTime) ||
    !Number.isFinite(session.focusedDurationSeconds)
  )
    return [];
  if (session.endTime >= midnight) return [];
  const date = new Date(session.startTime);
  date.setHours(0, 0, 0, 0);
  const start = date.getTime();
  date.setDate(date.getDate() + 1);
  return session.focusedDurationSeconds > 0
    ? [{ start, end: date.getTime(), seconds: session.focusedDurationSeconds }]
    : [];
}

/** Completed timer storage keeps the day split, while the active state retains retry intervals. */
export function summarizeTimerSession(session: FocusSession): FocusSession {
  const midnight = followingMidnight(session.startTime);
  const { focusIntervals: _temporary, ...saved } = session;
  if (session.endTime < midnight) {
    delete saved.focusedAfterMidnightSeconds;
    return saved;
  }
  return {
    ...saved,
    focusedAfterMidnightSeconds: session.focusedAfterMidnightSeconds ?? reconstructFocusedAfterMidnight(session),
  };
}
