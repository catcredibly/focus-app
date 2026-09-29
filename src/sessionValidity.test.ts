import { expect, it } from "vitest";
import { sessionInvalidReason, validSessions } from "./sessionValidity";
import type { AcademicYear } from "./types";

const year: AcademicYear = {
  id: "year",
  name: "Year",
  archived: false,
  startDate: "2025-03-01",
  endDate: "2025-11-30",
};
const interval = (start: string, end: string) => ({
  startTime: new Date(start).getTime(),
  endTime: new Date(end).getTime(),
});
it("uses the full interval and inclusive local dates", () => {
  expect(sessionInvalidReason(interval("2025-03-01T00:00:00", "2025-11-30T23:59:59"), year)).toBeUndefined();
  expect(sessionInvalidReason(interval("2025-11-30T23:00:00", "2025-12-01T00:00:00"), year)).toBe("after");
  expect(sessionInvalidReason(interval("2025-02-28T23:00:00", "2025-03-01T01:00:00"), year)).toBe("before");
});
it("treats missing boundaries independently and recomputes after edits", () => {
  const session = interval("2025-02-28T23:00:00", "2025-12-01T01:00:00");
  expect(sessionInvalidReason(session, year)).toBe("outside");
  expect(sessionInvalidReason(session, { ...year, startDate: undefined })).toBe("after");
  expect(sessionInvalidReason(session, { ...year, endDate: undefined })).toBe("before");
  expect(sessionInvalidReason(session, { ...year, startDate: "2025-02-28", endDate: "2025-12-01" })).toBeUndefined();
});

it("marks unrecoverable overnight and multi-date Sessions invalid without changing them", () => {
  const start = new Date(2025, 5, 1, 23).getTime();
  const missingSplit = { ...interval("2025-06-01T23:00:00", "2025-06-02T01:00:00"), focusedDurationSeconds: 3600 };
  const tooLong = { ...missingSplit, endTime: new Date(2025, 5, 3, 0).getTime() };
  expect(sessionInvalidReason(missingSplit, undefined)).toBe("missingOvernightSplit");
  expect(sessionInvalidReason(tooLong, undefined)).toBe("moreThanTwoDates");
  expect(
    validSessions(
      [missingSplit, tooLong].map((row, index) => ({
        ...row,
        id: String(index),
        subjectId: "subject",
        subjectName: "Subject",
        academicYearId: "year",
        academicYearName: "Year",
        archived: false,
      })),
      [],
    ),
  ).toEqual([]);
  expect(missingSplit.startTime).toBe(start);
  expect(missingSplit).not.toHaveProperty("focusedAfterMidnightSeconds");
});
