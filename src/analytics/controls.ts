import type { Aggregation } from "./periods";
export const DEFAULT_WEEKDAY_METRIC = "seconds";
export function availableGoalMode(daily: boolean, weekly: boolean, selected: "daily" | "weekly") {
  return daily && weekly ? selected : weekly ? "weekly" : "daily";
}
export function compatibleGoalGrouping(mode: "daily" | "weekly", grouping: Aggregation): Aggregation {
  return mode === "weekly" && grouping === "daily" ? "weekly" : grouping;
}
