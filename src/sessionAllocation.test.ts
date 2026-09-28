import { describe, expect, it } from "vitest";
import type { FocusSession } from "./types";
import { dailyFocusAllocations, hasUsableFocusIntervals, removesExactFocusTiming } from "./sessionAllocation";
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
  it("uses proportional allocation for missing, obsolete, or overlapping intervals", () => {
    for (const focusIntervals of [
      undefined,
      [{ startTime: at(20, 22), endTime: at(21, 0) }],
      [
        { startTime: at(20, 23), endTime: at(21, 0) },
        { startTime: at(20, 23), endTime: at(21, 0) },
      ],
    ]) {
      expect(dailyFocusAllocations({ ...session, focusIntervals }).map((day) => day.seconds)).toEqual([2400, 4800]);
    }
  });
  it("preserves the exact stored total across multiple local days including a DST boundary", () => {
    const row = { ...session, startTime: at(26, 23), endTime: at(29, 3), focusedDurationSeconds: 12347 };
    expect(dailyFocusAllocations(row).reduce((sum, day) => sum + day.seconds, 0)).toBe(12347);
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
