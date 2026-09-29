import { expect, it } from "vitest";
import {
  editedSessionTimes,
  sessionDayOffset,
  sessionEditTiming,
  sessionSpanSeconds,
  manualEndOffset,
} from "./sessionDuration";
it("infers an overnight offset while respecting explicit multi-day offsets", () => {
  const same = editedSessionTimes("2026-09-20", "23:00", "23:00");
  expect(same.endTime).toBe(same.startTime);
  const backwards = editedSessionTimes("2026-09-20", "23:00", "01:00");
  expect(sessionDayOffset(backwards.startTime, backwards.endTime)).toBe(1);
  expect(manualEndOffset("21:00", "02:00")).toBe(1);
  expect(manualEndOffset("21:00", "23:00")).toBe(0);
  expect(manualEndOffset("21:00", "23:00", 3)).toBe(3);
  expect(editedSessionTimes("2026-09-20", "23:00", "01:00", undefined, 0).endTime).toBeLessThan(backwards.startTime);
  const multi = editedSessionTimes("2026-09-20", "23:00", "23:00", undefined, 3);
  expect(sessionDayOffset(multi.startTime, multi.endTime)).toBe(3);
  expect(sessionSpanSeconds(multi.startTime, multi.endTime)).toBe(72 * 3600);
});
it("preserves timer duration and relative pause timing when relocated", () => {
  const s = {
    id: "s",
    subjectId: "s",
    subjectName: "S",
    academicYearId: "y",
    academicYearName: "Y",
    archived: false,
    startTime: 1000,
    endTime: 12000,
    focusedDurationSeconds: 8,
    focusIntervals: [
      { startTime: 1000, endTime: 6000 },
      { startTime: 9000, endTime: 12000 },
    ],
  };
  expect(sessionEditTiming(s, 11000, 999999)).toMatchObject({
    startTime: 11000,
    endTime: 22000,
    focusedDurationSeconds: 8,
    focusIntervals: [
      { startTime: 11000, endTime: 16000 },
      { startTime: 19000, endTime: 22000 },
    ],
  });
  expect(sessionEditTiming({ ...s, manual: true }, 11000, 999999).focusedDurationSeconds).toBe(988.999);
});

it("represents nine manual days and derives longer timer offsets without a runtime cap", () => {
  const manual = editedSessionTimes("2026-10-01", "01:00", "01:00", undefined, 9);
  expect(sessionDayOffset(manual.startTime, manual.endTime)).toBe(9);
  expect(sessionDayOffset(new Date(2026, 9, 1).getTime(), new Date(2026, 9, 14).getTime())).toBe(13);
  expect(manualEndOffset("23:00", "01:00", 9)).toBe(9);
});
