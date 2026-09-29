import type { FocusSession } from "./types";

export type DurationMode = "locked" | "unlocked";
export type DurationParts = { hours: number; minutes: number; seconds: number };

export function sessionSpanSeconds(startTime: number, endTime: number) {
  return Math.max(0, (endTime - startTime) / 1000);
}

export function inferDurationMode(
  session: Pick<FocusSession, "startTime" | "endTime" | "focusedDurationSeconds" | "durationMode">,
): DurationMode {
  return (
    session.durationMode ??
    (session.focusedDurationSeconds === sessionSpanSeconds(session.startTime, session.endTime) ? "locked" : "unlocked")
  );
}

export function durationParts(totalSeconds: number): DurationParts {
  const total = Math.max(0, Math.round(totalSeconds));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function normalizeDurationParts(hours: number, minutes: number, seconds: number) {
  const totalSeconds = Math.max(
    0,
    Math.trunc(hours || 0) * 3600 + Math.trunc(minutes || 0) * 60 + Math.trunc(seconds || 0),
  );
  return { totalSeconds, parts: durationParts(totalSeconds) };
}

export function formatClockDuration(totalSeconds: number) {
  const parts = durationParts(totalSeconds);
  return `${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}`;
}

/** Resolve the editor's local date/time fields without losing untouched timer precision. */
export function editedSessionTimes(
  date: string,
  start: string,
  end: string,
  original?: Pick<FocusSession, "startTime" | "endTime">,
) {
  const localDate = (stamp: number) => {
    const d = new Date(stamp);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  };
  const time = (stamp: number) => new Date(stamp).toTimeString().slice(0, 5);
  const sameStart = original && date === localDate(original.startTime) && start === time(original.startTime);
  const startTime = sameStart ? original.startTime : new Date(date + "T" + start).getTime();
  const endDate = new Date(date + "T" + end);
  if (end < start) endDate.setDate(endDate.getDate() + 1);
  const endTime = sameStart && end === time(original.endTime) ? original.endTime : endDate.getTime();
  return { startTime, endTime };
}
