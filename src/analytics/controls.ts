import type { Aggregation } from "./periods";
export const DEFAULT_WEEKDAY_METRIC = "seconds";
export function availableGoalMode(daily: boolean, weekly: boolean, selected: "daily" | "weekly") {
  return daily && weekly ? selected : weekly ? "weekly" : "daily";
}
export function compatibleGoalGrouping(mode: "daily" | "weekly", grouping: Aggregation): Aggregation {
  return mode === "weekly" && grouping === "daily" ? "weekly" : grouping;
}

export const DEFAULT_WEEKDAY_MODE = "average";
export type WeekdayMode = "total" | "average";
export function weekdayChartMode(metric: string, selected: WeekdayMode): WeekdayMode {
  return metric === "average" ? "average" : selected;
}
export function weekdayChartTitle(metric: string, mode: WeekdayMode) {
  if (metric === "average") return "Average session by weekday";
  if (metric === "count") return mode === "total" ? "Total Sessions by weekday" : "Average Sessions by weekday";
  return mode === "total" ? "Total focus time by weekday" : "Average focus time by weekday";
}
export function weekdayChartValue(
  row: {
    seconds: number;
    count: number;
    averageFocusSeconds: number;
    averageSessionCount: number;
    averageSessionSeconds: number | null;
  },
  metric: string,
  mode: WeekdayMode,
) {
  if (metric === "average") return row.averageSessionSeconds;
  if (metric === "count") return mode === "total" ? row.count : row.averageSessionCount;
  return mode === "total" ? row.seconds : row.averageFocusSeconds;
}
