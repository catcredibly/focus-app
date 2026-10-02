// @vitest-environment jsdom
import { act, useMemo } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { FocusSession, Subject } from "../types";
import { AnalyticsSnapshotContext } from "../analytics/SnapshotContext";
import { createAnalyticsSnapshot } from "../analytics/snapshot";
import { useAnalyticsScopes } from "./useAnalyticsScopes";
import { useSubjectAnalyticsData } from "./useSubjectAnalyticsData";
import { useAnalyticsClock } from "./useAnalyticsClock";
import { analyticsScopes } from "../analytics/scopes";
import { goalAchievement } from "../analytics/goalAchievement";
import { localDayBounds, localWeekBounds } from "../goals";
import type { AnalyticsRange, Period } from "../analytics/periods";
const at = (day: number, hour = 0, minute = 0, second = 0) => new Date(2026, 9, day, hour, minute, second).getTime();
const session: FocusSession = {
  id: "s",
  subjectId: "subject",
  subjectName: "Subject",
  academicYearId: "year",
  academicYearName: "Year",
  startTime: at(1, 12),
  endTime: at(1, 13),
  focusedDurationSeconds: 3600,
  archived: false,
};
const sessions = [session];
const subjects: Subject[] = [
  { id: "subject", academicYearId: "year", name: "Subject", color: "#4da3ff", archived: false },
];
const years = [{ id: "year", name: "Year", archived: false }];
const yearIds: string[] = [],
  subjectIds: string[] = [];
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
type Props = {
  sessions: FocusSession[];
  subjects: Subject[];
  range?: AnalyticsRange;
  today?: number;
  locale?: string;
  subjectIds?: string[];
  custom?: Period;
  tick?: number;
};
let scopes: ReturnType<typeof useAnalyticsScopes>, data: ReturnType<typeof useSubjectAnalyticsData>;
function Derived({
  scopes: scope,
  subjects: subjectRows,
  locale,
}: {
  scopes: typeof scopes;
  subjects: Subject[];
  locale: string;
}) {
  data = useSubjectAnalyticsData(scope.filtered, scope.history, subjectRows, years, scope.period, locale);
  return <span>{data.total}</span>;
}
function Harness(props: Props) {
  scopes = useAnalyticsScopes(
    props.sessions,
    yearIds,
    props.subjectIds ?? subjectIds,
    false,
    props.range ?? "All",
    props.today ?? at(2),
    props.custom,
  );
  const snapshot = useMemo(() => createAnalyticsSnapshot(props.sessions), [props.sessions]);
  return (
    <AnalyticsSnapshotContext.Provider value={snapshot}>
      <Derived scopes={scopes} subjects={props.subjects} locale={props.locale ?? "en-US"} />
    </AnalyticsSnapshotContext.Provider>
  );
}
const render = async (overrides: Partial<Props> = {}) => {
  await act(async () => root.render(<Harness sessions={sessions} subjects={subjects} {...overrides} />));
};
it("keeps derived data and filter arrays stable for unrelated rerenders", async () => {
  await render();
  const initialData = data,
    initialScopes = scopes;
  await render({ tick: 1 });
  expect(data).toBe(initialData);
  expect(scopes.history).toBe(initialScopes.history);
  expect(scopes.filtered).toBe(initialScopes.filtered);
  expect(scopes.goalHistory).toBe(sessions);
});
it("invalidates immediately on a changed Session snapshot even when IDs are unchanged", async () => {
  await render();
  const initial = data;
  await render({ sessions: [{ ...session, focusedDurationSeconds: 1800 }] });
  expect(data).not.toBe(initial);
  expect(data.total).toBe(1800);
  await render({ sessions: [] });
  expect(data.total).toBe(0);
});
it("updates names, colors, locale, filters and numeric range boundaries", async () => {
  await render();
  await render({ subjects: [{ ...subjects[0], name: "Renamed", color: "#ff4d57" }] });
  expect(data.rows[0].name).toBe("Subject"); // Preserve the stored Session name, as before.
  await render({
    sessions: [{ ...session, subjectName: "Renamed" }],
    subjects: [{ ...subjects[0], name: "Renamed", color: "#ff4d57" }],
  });
  expect(data.rows[0].name).toBe("Renamed");
  expect(data.rows[0].color).toBe("#ff4d57");
  const english = data.share[0].label;
  await render({ locale: "ja-JP" });
  expect(data.share[0].label).not.toBe(english);
  await render({ subjectIds: ["different"] });
  expect(data.rows).toEqual([]);
  expect(scopes.goalHistory).toBe(sessions);
  const custom = { start: at(1), end: at(2) };
  await render({ range: "Custom", custom });
  const initial = data;
  await render({ range: "Custom", custom: { ...custom } });
  expect(data).toBe(initial);
  await render({ range: "Custom", custom: { start: at(2), end: at(3) } });
  expect(data.total).toBe(0);
});
it("preserves existing scope semantics and updates rolling ranges at midnight", async () => {
  await render({ range: "7D", today: at(2) });
  expect(scopes).toEqual(analyticsScopes(sessions, {}, "7D", at(2)));
  const before = scopes;
  await render({ range: "7D", today: at(3) });
  expect(scopes.history).toBe(before.history);
  expect(scopes.period.end).toBe(at(4));
  expect(scopes.period.start).not.toBe(before.period.start);
  expect(scopes.filtered).not.toBe(before.filtered);
});
it("refreshes at midnight and catches up immediately after suspension", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(at(4, 23, 59, 59));
  let clock: ReturnType<typeof useAnalyticsClock>;
  function Clock() {
    clock = useAnalyticsClock();
    return <span>{clock.today}</span>;
  }
  await act(async () => root.render(<Clock />));
  expect(clock!.today).toBe(at(4));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(clock!.today).toBe(at(5));
  vi.setSystemTime(at(8, 14));
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(clock!.today).toBe(at(8));
  expect(clock!.now).toBe(at(8, 14));
  expect(localDayBounds(clock!.now).start).toBe(at(8));
  expect(localWeekBounds(clock!.now).start).toBe(at(5));
});
it("retains minute-dependent weekly goal clipping instead of reusing daily totals", () => {
  const start = at(5, 12),
    end = at(5, 14);
  const history = [
    {
      ...session,
      startTime: start,
      endTime: end,
      focusedDurationSeconds: 7200,
      focusIntervals: [{ startTime: start, endTime: end }],
    },
  ];
  const period = { start: at(5), end: at(12) };
  const first = goalAchievement(history, period, "weekly", "weekly", 7200, at(5, 13));
  const next = goalAchievement(history, period, "weekly", "weekly", 7200, at(5, 13, 1));
  expect(first[0].seconds).toBe(3600);
  expect(next[0].seconds).toBe(3660);
});
