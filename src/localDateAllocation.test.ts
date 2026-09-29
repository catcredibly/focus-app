import { sessionMaximumEnd } from "./sessionBoundary";
import { expect, it } from "vitest";
import { editedSessionTimes, sessionSpanSeconds } from "./sessionDuration";
import { dailyFocusAllocations } from "./sessionAllocation";
import { sessionInvalidReason } from "./sessionValidity";
import type { FocusSession } from "./types";
it("allocates local days through spring and autumn DST transitions without 24-hour assumptions", () => {
  // This focused file runs under America/New_York in the verification command.
  const old = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    for (const [date, hours] of [
      ["2026-03-07", 3],
      ["2026-10-31", 5],
    ] as const) {
      const times = editedSessionTimes(date, "23:00", "03:00");
      expect(sessionMaximumEnd(times.startTime) - times.startTime).toBe((hours + 21) * 3600000 - 1000);
      expect(sessionSpanSeconds(times.startTime, times.endTime)).toBe(hours * 3600);
      const session: FocusSession = {
        id: "s",
        subjectId: "s",
        subjectName: "S",
        academicYearId: "y",
        academicYearName: "Y",
        archived: false,
        ...times,
        focusedDurationSeconds: hours * 3600,
        focusIntervals: [times],
      };
      const portions = dailyFocusAllocations(session);
      expect(portions.map((part) => part.seconds)).toEqual([3600, (hours - 1) * 3600]);
      expect(portions.reduce((sum, part) => sum + part.seconds, 0)).toBe(session.focusedDurationSeconds);
      const year = { id: "y", name: "Y", archived: false, startDate: date, endDate: date };
      expect(sessionInvalidReason(session, year)).toBe("after");
      const midnight = new Date(times.startTime);
      midnight.setHours(24, 0, 0, 0);
      expect(
        sessionInvalidReason({ startTime: session.startTime, endTime: midnight.getTime() - 1 }, year),
      ).toBeUndefined();
      expect(sessionInvalidReason({ startTime: session.startTime, endTime: midnight.getTime() }, year)).toBe("after");
    }
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
