import type { AcademicYear, FocusSession, Subject } from "../types";
import { startOfLocalDay } from "./analytics";
import { matchesSelection } from "../selectorOptions";

export function dailyActivityScope(
  sessions: FocusSession[],
  years: AcademicYear[],
  subjects: Subject[],
  yearId: string | string[],
  subjectId: string | string[],
  now = Date.now(),
) {
  const yearIds = typeof yearId === "string" ? (yearId ? [yearId] : []) : yearId;
  const subjectIds = typeof subjectId === "string" ? (subjectId ? [subjectId] : []) : subjectId;
  const subjectParents = new Set(
    subjects.filter((subject) => subjectIds.includes(subject.id)).map((subject) => subject.academicYearId),
  );
  const parentId =
    yearIds.length === 1
      ? yearIds[0]
      : !yearIds.length && subjectIds.length && subjectParents.size === 1
        ? [...subjectParents][0]
        : undefined;
  const year = years.find((item) => item.id === parentId);
  const matching = sessions.filter(
    (session) => matchesSelection(session.academicYearId, yearIds) && matchesSelection(session.subjectId, subjectIds),
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
