import { validSessions } from "../sessionValidity";
import { goalProgress } from "../goals";
import { dailyTotals, weekdayTotals } from "./analytics";
import { describe, expect, it } from "vitest";
import type { FocusSession } from "../types";
import { goalAchievement } from "./goalAchievement";
import { academicYearProgress } from "./yearProgress";
import { analyticsPeriod, calendarBuckets, rollingTimeline } from "./periods";
const at = (day: number, hour = 0) => new Date(2026, 8, day, hour).getTime();
const row = (day: number, seconds: number): FocusSession => ({
  id: String(day),
  subjectId: "s",
  subjectName: "Subject",
  academicYearId: "y",
  academicYearName: "Year",
  archived: false,
  startTime: at(day, 12),
  endTime: at(day, 12) + seconds * 1000,
  focusedDurationSeconds: seconds,
});
describe("analytics refinements", () => {
  it("anchors historical ranges to the year and leaves Custom unchanged", () => {
    const year = { id: "y", name: "Year", archived: false, startDate: "2026-09-01", endDate: "2026-09-20" };
    expect(analyticsPeriod("7D", [], at(29), undefined, year)).toEqual({ start: at(14), end: at(21) });
    const custom = { start: at(25), end: at(28) };
    expect(analyticsPeriod("Custom", [], at(29), custom, year)).toEqual(custom);
  });
  it("keeps session averages whole while splitting calendar focus across midnight", () => {
    const overnight = {
      ...row(20, 7200),
      startTime: at(20, 23),
      endTime: at(21, 1),
      manual: true as const,
    };
    const points = calendarBuckets([overnight], { start: at(20), end: at(22) }, "daily");
    expect(points.map((point) => [point.seconds, point.sessionCount, point.averageSeconds])).toEqual([
      [3600, 1, 7200],
      [3600, 0, 0],
    ]);
  });
  it("uses only elapsed days for daily achievement and pending weeks for weekly achievement", () => {
    const history = [row(7, 100), row(14, 100), row(21, 50)];
    const period = { start: at(7), end: at(28) };
    const pending = goalAchievement(history, period, "weekly", "monthly", 100, at(23));
    expect(pending[0]).toMatchObject({ achieved: 2, applicable: 2, pending: 1, goalPercent: 100 });
    const achieved = goalAchievement([...history, row(22, 50)], period, "weekly", "monthly", 100, at(23));
    expect(achieved[0]).toMatchObject({ achieved: 3, applicable: 3, pending: 0, goalPercent: 100 });
    const finished = goalAchievement(history, period, "weekly", "monthly", 100, at(28));
    expect(finished[0].goalPercent).toBeCloseTo(200 / 3);
    const daily = goalAchievement([row(21, 100)], { start: at(21), end: at(28) }, "daily", "weekly", 100, at(23, 15));
    expect(daily[0]).toMatchObject({ applicable: 3, achieved: 1 });
  });
  it("excludes pre-history zero days from all rolling windows", () => {
    const points = rollingTimeline([row(20, 100)], { start: at(19), end: at(22) });
    expect(points[0].avg7).toBeNull();
    expect(points[1].avg365).toBe(100);
    expect(points[2].avg30).toBe(50);
  });
  it("stops ongoing years at inclusive elapsed progress and excludes future or incomplete years", () => {
    const years = [
      { id: "y", name: "Year", archived: false, startDate: "2026-09-01", endDate: "2026-09-30" },
      { id: "future", name: "Future", archived: false, startDate: "2026-10-01", endDate: "2026-10-31" },
      { id: "missing", name: "Missing", archived: false },
    ];
    const [year] = academicYearProgress(years, [row(2, 100)], at(15));
    expect(academicYearProgress(years, [], at(15))).toHaveLength(1);
    expect(year.progress).toBe(50);
    expect(year.points.at(-1)).toMatchObject({ progress: 50, elapsedDays: 15, seconds: 100 });
    expect(year.activeDayRate).toBe(1 / 15);
    expect(academicYearProgress(years, [], at(30))[0]).toMatchObject({ progress: 100, ongoing: false });
  });
});

it("excludes invalid data consistently and revalidates without changing stored records", () => {
  const year = { id: "y", name: "Year", archived: false, startDate: "2026-09-10", endDate: "2026-09-30" };
  const all = [row(1, 500), row(20, 100)];
  const valid = validSessions(all, [year]);
  expect(valid.map((session) => session.id)).toEqual(["20"]);
  expect(dailyTotals(valid)).toHaveLength(1);
  expect(analyticsPeriod("All", valid, at(25)).start).toBe(at(20));
  expect(rollingTimeline(valid, { start: at(19), end: at(21) })[0].avg7).toBeNull();
  expect(goalProgress(valid, at(1, 15)).dailySeconds).toBe(0);
  expect(validSessions(all, [{ ...year, startDate: "2026-09-01" }])).toHaveLength(2);
  expect(all).toHaveLength(2);
  expect(validSessions([{ ...all[0], startTime: at(12), endTime: at(12) + 500000 }], [year])).toHaveLength(1);
});
it.each(["7D", "30D", "90D", "1Y"] as const)("anchors %s historical, ongoing and All Years ranges", (range) => {
  const year = { id: "y", name: "Year", archived: false, startDate: "2026-09-01", endDate: "2026-09-20" };
  expect(analyticsPeriod(range, [], at(29), undefined, year).end).toBe(at(21));
  expect(
    analyticsPeriod(range, [], at(29), undefined, { ...year, endDate: "2026-10-30" }).start,
  ).toBeGreaterThanOrEqual(at(1));
  expect(analyticsPeriod(range, [], at(29)).end).toBe(at(30));
  const custom = { start: at(1), end: at(3) };
  expect(analyticsPeriod("Custom", [], at(29), custom, year)).toEqual(custom);
});
it("keeps weekday count and whole-session averages separate from overnight calendar allocation", () => {
  const overnight = { ...row(20, 7200), startTime: at(20, 23), endTime: at(21, 1), manual: true as const };
  const values = weekdayTotals([overnight], { start: at(20), end: at(22) });
  expect(values.map((value) => value.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  expect(values[6]).toMatchObject({ count: 1, sessionSeconds: 7200, seconds: 3600 });
  expect(values[0]).toMatchObject({ count: 0, sessionSeconds: 0, seconds: 3600 });
  expect(values.reduce((sum, value) => sum + value.count, 0)).toBe(1);
});

it("bounds All to elapsed Academic Year days and preserves ended and custom ranges", () => {
  const year = { id: "y", name: "Y", archived: false, startDate: "2026-09-22", endDate: "2026-11-13" };
  expect(analyticsPeriod("All", [], at(29), undefined, year)).toEqual({ start: at(22), end: at(30) });
  const last = new Date(2026, 10, 13).getTime(),
    end = new Date(2026, 10, 14).getTime();
  expect(analyticsPeriod("All", [], last, undefined, year).end).toBe(end);
  expect(analyticsPeriod("All", [], end + 86400000, undefined, year).end).toBe(end);
  const custom = { start: at(1), end: new Date(2026, 11, 1).getTime() };
  expect(analyticsPeriod("Custom", [], at(29), custom, year)).toEqual(custom);
});
