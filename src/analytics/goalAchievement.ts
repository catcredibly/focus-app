import type { FocusSession } from "../types";
import { allocatedFocusInRange } from "../sessionAllocation";
import { startOfLocalDay, startOfLocalWeek } from "./analytics";
import { addDays, calendarBuckets, type Aggregation, type Period } from "./periods";

export type GoalPoint = Period & {
  seconds: number;
  achieved: number;
  applicable: number;
  pending: number;
  goalPercent: number | null;
};
export function goalAchievement(
  history: FocusSession[],
  period: Period,
  mode: "daily" | "weekly",
  grouping: Aggregation,
  target: number,
  now = Date.now(),
  weekMonth: "start" | "end" = "start",
): GoalPoint[] {
  if (!(target > 0)) return [];
  const today = startOfLocalDay(now),
    end = Math.min(period.end, addDays(today, 1));
  if (end <= period.start) return [];
  if (mode === "daily")
    return calendarBuckets(history, { start: period.start, end }, grouping, target).map((bucket) => ({
      ...bucket,
      achieved: bucket.goalMetDays,
      applicable: bucket.days,
      pending: 0,
    }));
  const result: GoalPoint[] = [];
  let progressTotal = 0;
  for (let start = startOfLocalWeek(period.start); start < end; start = addDays(start, 7)) {
    const weekEnd = addDays(start, 7);
    const seconds = history.reduce(
      (sum, session) =>
        sum + allocatedFocusInRange(session, Math.max(start, period.start), Math.min(weekEnd, period.end, now)),
      0,
    );
    const achieved = Number(seconds >= target),
      pending = Number(!achieved && weekEnd > now);
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
        achieved: 0,
        applicable: 0,
        pending: 0,
        goalPercent: null,
      };
      result.push(bucket);
      progressTotal = 0;
    }
    bucket.seconds += seconds;
    bucket.achieved += achieved;
    bucket.applicable += 1;
    progressTotal += Math.min(1, seconds / target);
    bucket.pending += pending;
    bucket.goalPercent = bucket.applicable ? (100 * progressTotal) / bucket.applicable : null;
  }
  return result;
}
