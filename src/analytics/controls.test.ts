import { describe, expect, it } from "vitest";
import { DEFAULT_WEEKDAY_MODE, weekdayChartMode, weekdayChartTitle, weekdayChartValue } from "./controls";
import { weekdayAverages } from "./analytics";
import type { FocusSession } from "../types";

describe("weekday chart modes", () => {
  it("defaults to Average and preserves the applicable selection across Average session", () => {
    expect(DEFAULT_WEEKDAY_MODE).toBe("average");
    expect(weekdayChartMode("seconds", "total")).toBe("total");
    expect(weekdayChartMode("average", "total")).toBe("average");
    expect(weekdayChartMode("count", "total")).toBe("total");
  });
  it("uses calendar averages or totals without changing average Session length", () => {
    const start = new Date(2026, 8, 7).getTime();
    const row = {
      id: "s",
      subjectId: "subject",
      subjectName: "Subject",
      academicYearId: "year",
      academicYearName: "Year",
      startTime: start,
      endTime: start + 7200000,
      focusedDurationSeconds: 7200,
      focusIntervals: [{ startTime: start, endTime: start + 7200000 }],
      archived: false,
    } satisfies FocusSession;
    const monday = weekdayAverages([row], { start, end: new Date(2026, 9, 5).getTime() })[0];
    expect(weekdayChartValue(monday, "seconds", "total")).toBe(7200);
    expect(weekdayChartValue(monday, "seconds", "average")).toBe(1800);
    expect(weekdayChartValue(monday, "count", "total")).toBe(1);
    expect(weekdayChartValue(monday, "count", "average")).toBe(0.25);
    expect(weekdayChartValue(monday, "average", "total")).toBe(7200);
    expect(weekdayChartValue(monday, "average", "average")).toBe(7200);
  });
  it("uses the requested metric and mode titles", () => {
    expect(weekdayChartTitle("seconds", "average")).toBe("Average focus time by weekday");
    expect(weekdayChartTitle("seconds", "total")).toBe("Total focus time by weekday");
    expect(weekdayChartTitle("count", "average")).toBe("Average Sessions by weekday");
    expect(weekdayChartTitle("count", "total")).toBe("Total Sessions by weekday");
    expect(weekdayChartTitle("average", "total")).toBe("Average session by weekday");
  });
});
