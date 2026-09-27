import { expect, it } from "vitest";
import { dailyActivityScope } from "./dailyActivity";
import type { FocusSession } from "../types";
const stamp = (day: number) => new Date(2026, 8, day).getTime();
const years = [
  { id: "a", name: "A", archived: false, startDate: "2026-09-01", endDate: "2026-10-01" },
  { id: "b", name: "B", archived: false, startDate: "2026-10-01" },
];
const subjects = [{ id: "math", name: "Math", color: "red", academicYearId: "a", archived: false }];
const rows = [
  { id: "1", academicYearId: "a", subjectId: "math", startTime: stamp(3) },
  { id: "2", academicYearId: "b", subjectId: "other", startTime: stamp(4) },
] as FocusSession[];
it("uses entity dates and matching Sessions independently of chart date ranges", () => {
  const scoped = dailyActivityScope(rows, years, subjects, "", "math", stamp(20));
  expect(scoped).toMatchObject({ start: stamp(1), end: stamp(20), sessions: [rows[0]] });
  expect(dailyActivityScope([], years, subjects, "a", "", stamp(20))).toMatchObject({
    start: stamp(1),
    end: stamp(20),
    sessions: [],
  });
  expect(dailyActivityScope(rows, years, subjects, "", "", stamp(20)).sessions).toEqual(rows);
});
it("handles future years and optional date boundaries", () => {
  expect(dailyActivityScope(rows, years, subjects, "b", "", stamp(20)).futureStart).toBe(
    new Date(2026, 9, 1).getTime(),
  );
  const flexible = [{ ...years[0], startDate: undefined, endDate: undefined }];
  expect(dailyActivityScope(rows, flexible, subjects, "a", "", stamp(20))).toMatchObject({
    start: stamp(3),
    end: stamp(20),
  });
});
