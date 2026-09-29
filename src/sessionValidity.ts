import type { AcademicYear, FocusSession } from "./types";
import { followingMidnight, sessionMaximumEnd, overnightAllocationValid } from "./sessionBoundary";
import { reconstructFocusedAfterMidnight } from "./sessionAllocation";

export type SessionValidityReason =
  | "before"
  | "after"
  | "outside"
  | "invalidTiming"
  | "invalidDuration"
  | "missingOvernightSplit"
  | "invalidOvernightSplit"
  | "moreThanTwoDates";

/** Academic Year boundaries are inclusive local dates; midnight after the end is outside. */
export function sessionInvalidReason(
  session: Pick<FocusSession, "startTime" | "endTime"> &
    Partial<Pick<FocusSession, "focusedDurationSeconds" | "focusedAfterMidnightSeconds" | "focusIntervals">>,
  year: AcademicYear | undefined,
): SessionValidityReason | undefined {
  if (!Number.isFinite(session.startTime) || !Number.isFinite(session.endTime) || session.endTime <= session.startTime)
    return "invalidTiming";
  if (session.focusedDurationSeconds !== undefined && session.endTime > sessionMaximumEnd(session.startTime))
    return "moreThanTwoDates";
  if (
    session.focusedDurationSeconds !== undefined &&
    (!Number.isFinite(session.focusedDurationSeconds) ||
      session.focusedDurationSeconds <= 0 ||
      session.focusedDurationSeconds > (session.endTime - session.startTime) / 1000)
  )
    return "invalidDuration";
  if (session.focusedDurationSeconds !== undefined && session.endTime >= followingMidnight(session.startTime)) {
    const reconstructed = reconstructFocusedAfterMidnight(session as FocusSession);
    const after = session.focusedAfterMidnightSeconds ?? reconstructed;
    if (after === undefined) return "missingOvernightSplit";
    if (!overnightAllocationValid(session.startTime, session.endTime, session.focusedDurationSeconds, after))
      return "invalidOvernightSplit";
  }
  if (!year) return undefined;
  const start = year.startDate ? new Date(`${year.startDate}T00:00:00`).getTime() : -Infinity;
  const endDate = year.endDate ? new Date(`${year.endDate}T00:00:00`) : undefined;
  endDate?.setDate(endDate.getDate() + 1);
  const end = endDate?.getTime() ?? Infinity;
  const before = session.startTime < start;
  const after = session.endTime >= end;
  return before && after ? "outside" : before ? "before" : after ? "after" : undefined;
}

export const invalidReasonText = {
  before: "Session starts before the Academic Year begins.",
  after: "Session ends after the Academic Year ends.",
  outside: "Session falls outside its Academic Year's date range and is excluded from Analytics.",
  invalidTiming:
    "Invalid session\nThis session has invalid start or end timing. Edit the session to correct its timing. It is excluded from totals and analytics until corrected.",
  invalidDuration:
    "Invalid session\nThis session's focused duration is not compatible with its start and end time. Edit the session to correct its duration. It is excluded from totals and analytics until corrected.",
  missingOvernightSplit:
    "Invalid session\nThis session spans two dates, but its focus time before and after midnight is not specified. Edit the session to specify the focus time for each date. It is excluded from totals and analytics until corrected.",
  invalidOvernightSplit:
    "Invalid session\nThis session's focus time before or after midnight exceeds the time available on that date. Edit the session to correct the split. It is excluded from totals and analytics until corrected.",
  moreThanTwoDates:
    "Invalid session\nThis session spans more than two calendar dates. Sessions may span at most two dates. Edit the session to correct its timing. It is excluded from totals and analytics until corrected.",
} as const;

export function validSessions(sessions: FocusSession[], years: AcademicYear[]) {
  const byId = new Map(years.map((year) => [year.id, year]));
  return sessions.filter((session) => !sessionInvalidReason(session, byId.get(session.academicYearId)));
}

export function newlyInvalidCount(sessions: FocusSession[], previous: AcademicYear, next: AcademicYear) {
  return sessions.filter(
    (session) =>
      session.academicYearId === previous.id &&
      !sessionInvalidReason(session, previous) &&
      sessionInvalidReason(session, next),
  ).length;
}
