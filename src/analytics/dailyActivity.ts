import type { AcademicYear, FocusSession, Subject } from "../types";
import { startOfLocalDay } from "./analytics";

export function dailyActivityScope(
  sessions: FocusSession[],
  years: AcademicYear[],
  subjects: Subject[],
  yearId: string,
  subjectId: string,
  now = Date.now(),
) {
  const parentId = yearId || subjects.find((subject) => subject.id === subjectId)?.academicYearId;
  const year = years.find((item) => item.id === parentId);
  const matching = sessions.filter(
    (session) => (!parentId || session.academicYearId === parentId) && (!subjectId || session.subjectId === subjectId),
  );
  if (!year) return { sessions: matching, start: undefined, end: undefined, futureStart: undefined };
  const day = (date?: string) => (date ? new Date(`${date}T00:00:00`).getTime() : NaN);
  const today = startOfLocalDay(now);
  const first = matching.reduce((stamp, session) => Math.min(stamp, startOfLocalDay(session.startTime)), Infinity);
  const start = Number.isFinite(day(year.startDate)) ? day(year.startDate) : Number.isFinite(first) ? first : today;
  const end = Math.min(today, Number.isFinite(day(year.endDate)) ? day(year.endDate) : today);
  return {
    start,
    end,
    futureStart: start > today ? start : undefined,
    sessions: matching.filter(
      (session) => startOfLocalDay(session.startTime) >= start && startOfLocalDay(session.startTime) <= end,
    ),
  };
}
