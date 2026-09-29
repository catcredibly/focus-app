import { expect, it } from "vitest";
import { editedSessionTimes, sessionDayOffset, sessionEditTiming, sessionSpanSeconds } from "./sessionDuration";
it("requires an explicit calendar offset, allowing equal clock times only on later dates", () => {
  const same = editedSessionTimes("2026-09-20", "23:00", "23:00");
  expect(same.endTime).toBe(same.startTime);
  const backwards = editedSessionTimes("2026-09-20", "23:00", "01:00");
  expect(backwards.endTime).toBeLessThan(backwards.startTime);
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
