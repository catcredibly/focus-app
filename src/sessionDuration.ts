import type { FocusSession } from "./types";

export type DurationMode = "locked" | "unlocked";
export type DurationParts = { hours: number; minutes: number; seconds: number };

export function sessionSpanSeconds(startTime: number, endTime: number) {
  return Math.max(0, Math.round((endTime - startTime) / 1000));
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
