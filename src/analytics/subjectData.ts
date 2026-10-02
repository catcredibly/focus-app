import type { AcademicYear, FocusSession, Subject } from "../types";
import { subjectTotals, localDayKey } from "./analytics";
import { orderSubjectsForStack } from "./subjectStack";
import type { Period } from "./periods";
import type { AllocationReader } from "./snapshot";
export function prepareSubjectAnalytics(
  sessions: FocusSession[],
  history: FocusSession[],
  subjects: Subject[],
  years: AcademicYear[],
  period: Period,
  locale: string,
  getDays: AllocationReader,
) {
  const rows = subjectTotals(sessions, subjects, getDays),
    total = rows.reduce((sum, row) => sum + row.seconds, 0);
  const names = new Map(
    rows.map((row) => [row.subjectId, `${row.name} · ${years.find((y) => y.id === row.academicYearId)?.name ?? ""}`]),
  );
  const shareRows = subjectTotals(
    history.filter((session) => session.startTime < period.end && session.endTime > period.start),
    subjects,
    getDays,
  );
  const stackedShareRows = orderSubjectsForStack(shareRows);
  const shareNames = new Map(
    shareRows.map((row) => [
      row.subjectId,
      row.name + " · " + (years.find((year) => year.id === row.academicYearId)?.name ?? ""),
    ]),
  );
  const monthMap = new Map<string, Map<string, number>>();
  for (const s of history)
    for (const day of getDays(s)) {
      if (day.start < period.start || day.start >= period.end) continue;
      const month = localDayKey(day.start).slice(0, 7),
        values = monthMap.get(month) ?? new Map<string, number>();
      values.set(s.subjectId, (values.get(s.subjectId) ?? 0) + day.seconds);
      monthMap.set(month, values);
    }
  const share = [...monthMap]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => {
      const sum = [...values.values()].reduce((a, b) => a + b, 0);
      return {
        label: new Date(`${month}-01T12:00:00`).toLocaleDateString(locale, { month: "short", year: "numeric" }),
        shares: Object.fromEntries(
          shareRows.map((row) => [row.subjectId, ((values.get(row.subjectId) ?? 0) / sum) * 100]),
        ),
      };
    });
  return { rows, total, names, shareRows, stackedShareRows, shareNames, share };
}
