import type { DailySeriesReader } from "./snapshot";
import { dailyTotals } from "./analytics";
import type { FocusSession } from "../types";
import { allocatedFocusInRange } from "../sessionAllocation";
import { startOfLocalDay, startOfLocalWeek } from "./analytics";
import { addDays, calendarBuckets, type Aggregation, type Period } from "./periods";

export type GoalPoint = Period & {
  seconds: number;
  periodCount: number;
  goalSeconds: number;
  grouping: Aggregation;
  mode: "daily" | "weekly";
  goalPercent: number;
};
export function goalAchievement(
  history: FocusSession[],
  period: Period,
  mode: "daily" | "weekly",
  grouping: Aggregation,
  target: number,
  now = Date.now(),
  weekMonth: "start" | "end" = "start",
  getDailyTotals: DailySeriesReader = dailyTotals,
): GoalPoint[] {
  if (!(target > 0)) return [];
  const today = startOfLocalDay(now),
    end = Math.min(period.end, addDays(today, 1));
  if (end <= period.start) return [];
  if (mode === "daily")
    return calendarBuckets(history, { start: period.start, end }, grouping, target, getDailyTotals(history)).map(
      (bucket) => ({
        start: bucket.start,
        end: bucket.end,
        seconds: bucket.seconds,
        goalPercent: bucket.goalPercent,
        periodCount: bucket.days,
        goalSeconds: target,
        grouping,
        mode,
      }),
    );
  const result: GoalPoint[] = [];
  let progressTotal = 0;
  for (let start = startOfLocalWeek(period.start); start < end; start = addDays(start, 7)) {
    const weekEnd = addDays(start, 7);
    const seconds = history.reduce(
      (sum, session) =>
        sum + allocatedFocusInRange(session, Math.max(start, period.start), Math.min(weekEnd, period.end, now)),
      0,
    );
    const owner = new Date(weekMonth === "start" ? start : addDays(weekEnd, -1));
    const bucketStart = grouping === "monthly" ? new Date(owner.getFullYear(), owner.getMonth(), 1).getTime() : start;
    const bucketEnd =
      grouping === "monthly" ? new Date(owner.getFullYear(), owner.getMonth() + 1, 1).getTime() : weekEnd;
    let bucket = result.at(-1);
    if (!bucket || bucket.start !== bucketStart) {
      bucket = {
        start: bucketStart,
        end: bucketEnd,
        seconds: 0,
        periodCount: 0,
        goalSeconds: target,
        grouping,
        mode,
        goalPercent: 0,
      };
      result.push(bucket);
      progressTotal = 0;
    }
    bucket.seconds += seconds;
    bucket.periodCount += 1;
    progressTotal += seconds / target;
    bucket.goalPercent = (100 * progressTotal) / bucket.periodCount;
  }
  return result;
}

/** Keep the goal threshold visible; add rounded headroom only for overachievement. */
export function goalAxisMaximum(points: Pick<GoalPoint, "goalPercent">[]) {
  const highest = Math.max(100, ...points.map((point) => (Number.isFinite(point.goalPercent) ? point.goalPercent : 0)));
  if (highest <= 100) return 100;
  const step = 10 ** Math.floor(Math.log10(highest)) / 5;
  return Math.ceil((highest * 1.1) / step) * step;
}
