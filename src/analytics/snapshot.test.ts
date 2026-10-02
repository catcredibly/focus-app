import "fake-indexeddb/auto";
import { liveQuery } from "dexie";
import { expect, it, vi } from "vitest";
import * as allocation from "../sessionAllocation";
import { FocusDatabase } from "../db";
import type { FocusSession } from "../types";
import { createAnalyticsSnapshot } from "./snapshot";
import { prepareSubjectAnalytics } from "./subjectData";
import { dailyTotals, subjectTotals, academicYearTotals, weekdayTotals, filterSessions } from "./analytics";
import { calendarBuckets, summaryMetrics, personalBests, rollingTimeline, cumulativeDailyFocus } from "./periods";
import { goalAchievement } from "./goalAchievement";
import { createDevelopmentAnalyticsDataset } from "./developmentDataset";

const at = (day: number, hour = 0) => new Date(2026, 9, day, hour).getTime();
const row = (id = "one", seconds = 3600): FocusSession => ({
  id,
  subjectId: "s",
  subjectName: "Subject",
  academicYearId: "y",
  academicYearName: "Year",
  archived: false,
  startTime: at(1, 23),
  endTime: at(2, 1),
  focusedDurationSeconds: seconds,
});
const years = [{ id: "y", name: "Year", archived: false }];
const subjects = [{ id: "s", name: "Subject", academicYearId: "y", archived: false, color: "#4da3ff" }];
const period = { start: at(1), end: at(3) };
it("reuses allocations only within a snapshot, retaining the original scope and metric semantics", () => {
  const legacy = row();
  const exact = { ...row("two", 7200), focusIntervals: [{ startTime: at(1, 23), endTime: at(2, 1) }] };
  const manual = { ...row("manual", 7200), manual: true as const };
  const sessions = [legacy, exact, manual];
  const spy = vi.spyOn(allocation, "dailyFocusAllocations");
  try {
    const snapshot = createAnalyticsSnapshot(sessions);
    expect(spy).toHaveBeenCalledTimes(3);
    const points = snapshot.getDailyTotals(sessions);
    expect(snapshot.getDailyTotals(sessions)).toBe(points);
    expect(subjectTotals(sessions, subjects, snapshot.getDays)).toEqual(subjectTotals(sessions, subjects));
    expect(academicYearTotals(sessions, years, subjects, snapshot.getDays)).toEqual(
      academicYearTotals(sessions, years, subjects),
    );
    expect(weekdayTotals(sessions, period, snapshot.getDays)).toEqual(weekdayTotals(sessions, period));
    expect(calendarBuckets(sessions, period, "weekly", 0, points)).toEqual(calendarBuckets(sessions, period, "weekly"));
    expect(summaryMetrics(sessions, period, points)).toEqual(summaryMetrics(sessions, period));
    expect(personalBests(sessions, period, points)).toEqual(personalBests(sessions, period));
    expect(rollingTimeline(sessions, period, points)).toEqual(rollingTimeline(sessions, period));
    expect(cumulativeDailyFocus(sessions, period, points)).toEqual(cumulativeDailyFocus(sessions, period));
    expect(
      goalAchievement(sessions, period, "daily", "daily", 7200, at(2, 12), "start", snapshot.getDailyTotals),
    ).toEqual(goalAchievement(sessions, period, "daily", "daily", 7200, at(2, 12)));
    const changed = { ...legacy, focusedDurationSeconds: 1800 };
    expect(snapshot.getDays(changed)[0].seconds).toBe(1800); // same ID is never used as a cache key
    const fresh = createAnalyticsSnapshot([changed]);
    expect(fresh.getDailyTotals([changed])[0].seconds).toBe(1800);
  } finally {
    spy.mockRestore();
  }
});
it("performs one daily allocation pass for the 20,000-Session development snapshot", () => {
  const { sessions, subjects, academicYears } = createDevelopmentAnalyticsDataset(20_000);
  const spy = vi.spyOn(allocation, "dailyFocusAllocations");
  try {
    const snapshot = createAnalyticsSnapshot(sessions);
    const daily = snapshot.getDailyTotals(sessions);
    subjectTotals(sessions, subjects, snapshot.getDays);
    academicYearTotals(sessions, academicYears, subjects, snapshot.getDays);
    summaryMetrics(sessions, undefined, daily);
    weekdayTotals(sessions, undefined, snapshot.getDays);
    expect(spy).toHaveBeenCalledTimes(sessions.length);
  } finally {
    spy.mockRestore();
  }
});
it("observes add/edit/delete/import/recovery/reassignment immediately through the live IndexedDB snapshot", async () => {
  const database = new FocusDatabase(`analytics-snapshot-${crypto.randomUUID()}`);
  type Result = ReturnType<typeof prepareSubjectAnalytics> & { daily: ReturnType<typeof dailyTotals> };
  let latest: Result | undefined;
  const waiting: { predicate: (data: Result) => boolean; resolve: () => void }[] = [];
  const until = (predicate: (data: Result) => boolean) =>
    latest && predicate(latest)
      ? Promise.resolve()
      : new Promise<void>((resolve) => waiting.push({ predicate, resolve }));
  const subscription = liveQuery(() => database.sessions.toArray()).subscribe((sessions) => {
    const valid = filterSessions(sessions);
    const snapshot = createAnalyticsSnapshot(valid);
    latest = {
      ...prepareSubjectAnalytics(valid, valid, subjects, years, period, "en-US", snapshot.getDays),
      daily: snapshot.getDailyTotals(valid),
    };
    for (const waiter of [...waiting])
      if (waiter.predicate(latest)) {
        waiting.splice(waiting.indexOf(waiter), 1);
        waiter.resolve();
      }
  });
  try {
    await until((data) => data.total === 0);
    await database.sessions.put(row()); // add
    await until((data) => data.total === 3600);
    await database.sessions.update("one", { focusedDurationSeconds: 1800 }); // edit, same ID
    await until((data) => data.total === 1800);
    await database.sessions.bulkPut([row("imported", 900), row("recovered", 600)]); // imported/recovered commits
    await until((data) => data.total === 3300);
    await database.sessions.update("recovered", { focusIntervals: [{ startTime: at(2), endTime: at(2) + 600_000 }] });
    // Same ID and total, but newly recovered interval timing changes the daily Analytics.
    await until((data) => data.daily.find((day) => day.start === at(2))?.seconds === 600);
    await database.sessions.update("one", { subjectId: "new", subjectName: "New Subject", academicYearId: "new-year" });
    await until((data) => data.rows.some((r) => r.subjectId === "new" && r.academicYearId === "new-year"));
    await database.sessions.delete("one");
    await until((data) => data.total === 1500 && !data.rows.some((r) => r.subjectId === "new"));
  } finally {
    subscription.unsubscribe();
    await database.delete();
  }
});
