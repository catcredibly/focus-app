import { describe, expect, it } from "vitest";
import {
  durationParts,
  inferDurationMode,
  normalizeDurationParts,
  editedSessionTimes,
  sessionSpanSeconds,
} from "./sessionDuration";

describe("session duration editing", () => {
  it("infers legacy paused sessions as unlocked", () => {
    expect(inferDurationMode({ startTime: 0, endTime: 7200000, focusedDurationSeconds: 5400 })).toBe("unlocked");
    expect(inferDurationMode({ startTime: 0, endTime: 7200000, focusedDurationSeconds: 7200 })).toBe("locked");
  });

  it("respects an explicitly stored mode", () => {
    expect(
      inferDurationMode({ startTime: 0, endTime: 7200000, focusedDurationSeconds: 5400, durationMode: "locked" }),
    ).toBe("locked");
  });

  it("normalizes overflowing minutes and seconds", () => {
    expect(normalizeDurationParts(0, 75, 0)).toEqual({
      totalSeconds: 4500,
      parts: { hours: 1, minutes: 15, seconds: 0 },
    });
    expect(normalizeDurationParts(0, 360, 0).parts).toEqual({ hours: 6, minutes: 0, seconds: 0 });
    expect(normalizeDurationParts(0, 0, 90).parts).toEqual({ hours: 0, minutes: 1, seconds: 30 });
    expect(normalizeDurationParts(1, 75, 0).parts).toEqual({ hours: 2, minutes: 15, seconds: 0 });
    expect(durationParts(360005)).toEqual({ hours: 100, minutes: 0, seconds: 5 });
  });
});

it("resolves overnight editor values and preserves restored timing precision", () => {
  const overnight = editedSessionTimes("2026-09-15", "23:30", "00:30");
  expect(new Date(overnight.endTime).getDate()).toBe(16);
  expect(sessionSpanSeconds(overnight.startTime, overnight.endTime)).toBe(3600);
  const equal = editedSessionTimes("2026-09-15", "23:30", "23:30");
  expect(equal.endTime).toBe(equal.startTime);
  const precise = { startTime: overnight.startTime + 1234, endTime: overnight.endTime + 5678 };
  expect(editedSessionTimes("2026-09-15", "23:30", "00:30", precise)).toEqual(precise);
  expect(editedSessionTimes("2026-09-15", "23:31", "00:30", precise).startTime).not.toBe(precise.startTime);
});
