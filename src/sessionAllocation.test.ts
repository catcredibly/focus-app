import { timeOfDayMatrix, filterSessions } from "./analytics/analytics";
import { validSessions } from "./sessionValidity";
import { migrateLegacySession } from "./sessionDuration";
import { expect, it } from "vitest";
import { dailyFocusAllocations, exactFocusInRange, allocatedFocusInRange } from "./sessionAllocation";
import type { FocusSession } from "./types";
const start = new Date(2026, 8, 20, 23).getTime();
const row: FocusSession = {
  id: "s",
  subjectId: "s",
  subjectName: "S",
  academicYearId: "y",
  academicYearName: "Y",
  archived: false,
  startTime: start,
  endTime: start + 10800000,
  focusedDurationSeconds: 7200,
};
it("allocates exact pauses across any number of dates without duplicating focus", () => {
  const s = {
    ...row,
    endTime: start + 3 * 86400000,
    focusedDurationSeconds: 10800,
    focusIntervals: [
      { startTime: start, endTime: start + 7200000 },
      { startTime: start + 2 * 86400000, endTime: start + 2 * 86400000 + 3600000 },
    ],
  };
  expect(dailyFocusAllocations(s).map((day) => day.seconds)).toEqual([3600, 3600, 3600]);
  expect(exactFocusInRange(s, start + 7200000, start + 2 * 86400000)).toBe(0);
  expect(allocatedFocusInRange(s, start, s.endTime)).toBe(10800);
});
it("leaves historical totals on their original date without inventing intervals", () => {
  expect(dailyFocusAllocations(row).map((day) => day.seconds)).toEqual([7200]);
  expect(exactFocusInRange(row, start, row.endTime)).toBe(0);
  expect(row.focusIntervals).toBeUndefined();
});
it("allocates continuous manual focus across DST and multiple local dates", () => {
  const old = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    for (const [month, day, hours] of [
      [2, 7, 47],
      [9, 31, 49],
    ]) {
      const startTime = new Date(2026, month, day, 12).getTime();
      const endTime = new Date(2026, month, day + 2, 12).getTime();
      const s = {
        ...row,
        manual: true as const,
        startTime,
        endTime,
        focusedDurationSeconds: (endTime - startTime) / 1000,
      };
      const parts = dailyFocusAllocations(s);
      expect(parts).toHaveLength(3);
      expect(parts.reduce((sum, part) => sum + part.seconds, 0)).toBe(hours * 3600);
      expect(exactFocusInRange(s, startTime, endTime)).toBe(hours * 3600);
      expect(
        timeOfDayMatrix([s])
          .flat()
          .reduce((a, b) => a + b, 0),
      ).toBe(hours * 3600);
    }
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
it.each([{}, [null], [{ startTime: start + 1000, endTime: start }]])(
  "does not crash or fabricate timing for malformed intervals",
  (focusIntervals) => {
    const s = { ...row, focusIntervals } as unknown as FocusSession;
    expect(dailyFocusAllocations(s)[0].seconds).toBe(7200);
    expect(exactFocusInRange(s, start, row.endTime)).toBe(0);
  },
);

it("includes migrated legacy timing in weekday/time buckets and respects validity and range filters", () => {
  const legacy = migrateLegacySession({ ...row, focusedDurationSeconds: 25 * 3600, endTime: start + 3 * 86400000 });
  expect(legacy.endTime).toBe(start + 25 * 3600000);
  expect(legacy.focusIntervals).toBeUndefined();
  expect(
    timeOfDayMatrix([legacy])
      .flat()
      .reduce((a, b) => a + b, 0),
  ).toBe(25 * 3600);
  expect(
    timeOfDayMatrix([legacy], { start: start + 3600000, end: start + 7200000 })
      .flat()
      .reduce((a, b) => a + b, 0),
  ).toBe(3600);
  expect(filterSessions([legacy], { subjectId: "other" })).toEqual([]);
  expect(validSessions([legacy], [{ id: "y", name: "Y", archived: false, endDate: "2026-09-20" }])).toEqual([]);
});
