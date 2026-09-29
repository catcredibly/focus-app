import type { AcademicYear, FocusSession } from "./types";
export type SessionValidityReason = "before" | "after" | "outside";

/** Academic Year boundaries are inclusive local dates; midnight after the end is outside. */
export function sessionInvalidReason(
  session: Pick<FocusSession, "startTime" | "endTime">,
  year: AcademicYear | undefined,
): SessionValidityReason | undefined {
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
