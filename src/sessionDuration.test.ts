import { describe, expect, it } from "vitest";
import { durationParts, inferDurationMode, normalizeDurationParts } from "./sessionDuration";

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
