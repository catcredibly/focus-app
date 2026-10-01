import type { AcademicYear, FocusSession } from "../types";
import { filterSessions, type AnalyticsFilters } from "./analytics";
import { analyticsPeriod, type AnalyticsRange, type Period } from "./periods";

/** Goals share the selected time range, but never the selected year or subject. */
export function analyticsScopes(
  sessions: FocusSession[],
  filters: Pick<AnalyticsFilters, "academicYearId" | "subjectId" | "academicYearIds" | "subjectIds">,
  range: AnalyticsRange,
  now: number,
  customRange?: Period,
  year?: AcademicYear,
) {
  const history = filterSessions(sessions, filters);
  const period = analyticsPeriod(range, history, now, customRange, year);
  const goalHistory = filterSessions(sessions);
  return {
    history,
    period,
    filtered: filterSessions(history, period),
    goalHistory,
    goalPeriod: analyticsPeriod(range, goalHistory, now, customRange),
  };
}
