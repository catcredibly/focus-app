import { useMemo } from "react";
import { useAnalyticsSnapshot } from "../analytics/SnapshotContext";
import { prepareSubjectAnalytics } from "../analytics/subjectData";
import type { Period } from "../analytics/periods";
import type { AcademicYear, FocusSession, Subject } from "../types";
export function useSubjectAnalyticsData(
  sessions: FocusSession[],
  history: FocusSession[],
  subjects: Subject[],
  years: AcademicYear[],
  period: Period,
  locale: string,
) {
  const { getDays } = useAnalyticsSnapshot();
  return useMemo(
    () => prepareSubjectAnalytics(sessions, history, subjects, years, period, locale, getDays),
    [sessions, history, subjects, years, period.start, period.end, locale, getDays],
  );
}
