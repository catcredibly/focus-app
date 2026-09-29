import { describe, expect, it } from "vitest";
import type { FocusSession } from "./types";
import {
  allocatedFocusInRange,
  dailyFocusAllocations,
  hasUsableFocusIntervals,
  reconstructSessionFields,
  removesExactFocusTiming,
} from "./sessionAllocation";
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute).getTime();
const session: FocusSession = {
  id: "s",
  subjectId: "subject",
  subjectName: "Subject",
  academicYearId: "year",
  academicYearName: "Year",
  archived: false,
  startTime: at(20, 23),
  endTime: at(21, 2),
  focusedDurationSeconds: 7200,
};
describe("overnight focus allocation", () => {
  it("reconstructs an exact legacy split from stored focus intervals", () => {
    const row = {
      ...session,
      focusedDurationSeconds: 3600,
      focusIntervals: [
        { startTime: at(20, 23, 30), endTime: at(21, 0) },
        { startTime: at(21, 0, 30), endTime: at(21, 1) },
      ],
    };
    expect(reconstructSessionFields(row).focusedAfterMidnightSeconds).toBe(1800);
    expect(row).not.toHaveProperty("focusedAfterMidnightSeconds");
  });
  it("uses the saved split for daily totals and goal ranges", () => {
    const row = { ...session, focusedAfterMidnightSeconds: 6000 };
    expect(dailyFocusAllocations(row).map((day) => day.seconds)).toEqual([1200, 6000]);
    expect(allocatedFocusInRange(row, at(20, 0), at(21, 0))).toBe(1200);
    expect(allocatedFocusInRange(row, at(21, 0), at(22, 0))).toBe(6000);
    expect(allocatedFocusInRange(row, at(20, 0), at(22, 0))).toBe(7200);
  });
  it("uses exact intervals and retains a short pause", () => {
    const row = {
      ...session,
      focusedDurationSeconds: 10797,
      focusIntervals: [
        { startTime: at(20, 23), endTime: at(21, 0) },
        { startTime: at(21, 0) + 3000, endTime: at(21, 2) },
      ],
    };
    expect(hasUsableFocusIntervals(row)).toBe(true);
    expect(dailyFocusAllocations(row).map((day) => day.seconds)).toEqual([3600, 7197]);
  });
  it("does not estimate missing, obsolete, or overlapping intervals", () => {
    for (const focusIntervals of [
      undefined,
      [{ startTime: at(20, 22), endTime: at(21, 0) }],
      [
        { startTime: at(20, 23), endTime: at(21, 0) },
        { startTime: at(20, 23), endTime: at(21, 0) },
      ],
    ]) {
      expect(dailyFocusAllocations({ ...session, focusIntervals }).map((day) => day.seconds)).toEqual([]);
    }
  });
  it("excludes incompatible multi-date records without modifying them", () => {
    const row = { ...session, startTime: at(26, 23), endTime: at(29, 3), focusedDurationSeconds: 12347 };
    expect(dailyFocusAllocations(row).reduce((sum, day) => sum + day.seconds, 0)).toBe(0);
  });
  it("warns only when usable exact timing is actually changed", () => {
    const row = { ...session, focusIntervals: [{ startTime: at(20, 23), endTime: at(21, 1) }] };
    expect(removesExactFocusTiming(row, { ...row })).toBe(false);
    expect(removesExactFocusTiming(row, { ...row, startTime: row.startTime + 1000 })).toBe(true);
    expect(
      removesExactFocusTiming({ ...row, focusIntervals: undefined }, { ...row, focusedDurationSeconds: 6000 }),
    ).toBe(false);
    expect(removesExactFocusTiming({ ...row, focusedDurationSeconds: 6000 }, row)).toBe(false);
  });
});

it.each([
  {},
  "bad",
  [null],
  [42],
  [{ startTime: "bad", endTime: 10 }],
  [{ startTime: at(21, 1), endTime: at(21, 0) }],
  [
    { startTime: at(21, 0), endTime: at(21, 1) },
    { startTime: at(20, 23), endTime: at(21, 0) },
  ],
])("falls back safely for corrupt interval data: %j", (focusIntervals) => {
  const row = { ...session, focusIntervals } as unknown as FocusSession;
  expect(hasUsableFocusIntervals(row)).toBe(false);
  expect(dailyFocusAllocations(row)).toEqual([]);
});
