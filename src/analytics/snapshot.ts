import { dailyFocusAllocations } from "../sessionAllocation";
import type { FocusSession } from "../types";
import { dailyTotals, type TimePoint } from "./analytics";

export type AllocationReader = typeof dailyFocusAllocations;
export type DailySeriesReader = (sessions: FocusSession[]) => TimePoint[];
/** Owned by one live Analytics snapshot. Never indexed by Session ID or persisted. */
export function createAnalyticsSnapshot(sessions: FocusSession[]) {
  const allocations = new WeakMap(sessions.map((session) => [session, dailyFocusAllocations(session)]));
  const getDays: AllocationReader = (session) => allocations.get(session) ?? dailyFocusAllocations(session);
  const series = new WeakMap<FocusSession[], TimePoint[]>();
  const getDailyTotals: DailySeriesReader = (scope) => {
    let points = series.get(scope);
    if (!points) {
      points = dailyTotals(scope, getDays);
      series.set(scope, points);
    }
    return points;
  };
  return { getDays, getDailyTotals };
}
