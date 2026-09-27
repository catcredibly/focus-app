import type { FocusSession } from "../types";
import {
  calendarDailySeries,
  dailyTotals,
  filterSessions,
  localDayKey,
  startOfLocalDay,
  startOfLocalWeek,
  timeOfDayMatrix,
  totalFocusedSeconds,
} from "./analytics";

export const analyticsRanges = ["7D", "30D", "90D", "1Y", "All", "Custom"] as const;
export type AnalyticsRange = (typeof analyticsRanges)[number];
export type Aggregation = "daily" | "weekly" | "monthly";
export function goalAggregationModes(range: AnalyticsRange, days: number): Aggregation[] {
  if (range === "7D") return ["daily"];
  if (range === "30D" || (range === "Custom" && days <= 90)) return ["daily", "weekly"];
  return ["daily", "weekly", "monthly"];
}

export function goalDefaultAggregation(range: AnalyticsRange, days: number): Aggregation {
  if (range === "7D" || range === "30D" || (range === "Custom" && days <= 30)) return "daily";
  if (range === "90D" || (range === "Custom" && days <= 90)) return "weekly";
  return "monthly";
}
export type Period = { start: number; end: number };

export function addDays(stamp: number, days: number) {
  const date = new Date(stamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** Calendar arithmetic avoids 23/25-hour DST days changing period lengths. End is exclusive. */
export function calendarDays({ start, end }: Period) {
  const ordinal = (stamp: number) => {
    const d = new Date(stamp);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.max(0, Math.round((ordinal(end) - ordinal(start)) / 86_400_000));
}

export function analyticsPeriod(range: AnalyticsRange, sessions: FocusSession[], now: number, custom?: Period): Period {
  const today = startOfLocalDay(now),
    end = addDays(today, 1);
  if (range === "Custom" && custom) return custom;
  if (range === "All")
    return { start: sessions.reduce((first, s) => Math.min(first, startOfLocalDay(s.startTime)), today), end };
  const days = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
  return { start: addDays(end, -days), end };
}

export function previousPeriod(period: Period): Period {
  return { start: addDays(period.start, -calendarDays(period)), end: period.start };
}

export function defaultAggregation(range: AnalyticsRange, period: Period): Aggregation {
  if (range === "All") return "monthly";
  if (range === "1Y") return "weekly";
  const days = calendarDays(period);
  return days <= 90 ? "daily" : days <= 365 ? "weekly" : "monthly";
}

export type CalendarBucket = {
  key: string;
  start: number;
  end: number;
  days: number;
  seconds: number;
  sessionCount: number;
  averageSeconds: number;
  goalMetDays: number;
  goalPercent: number;
};

/** Empty days remain in each denominator; boundary buckets include only selected dates. */
export function calendarBuckets(
  sessions: FocusSession[],
  period: Period,
  aggregation: Aggregation,
  dailyGoal = 0,
): CalendarBucket[] {
  const result: CalendarBucket[] = [];
  for (const day of calendarDailySeries(sessions, period.start, period.end)) {
    const date = new Date(day.start);
    const key = localDayKey(
      aggregation === "daily"
        ? day.start
        : aggregation === "weekly"
          ? startOfLocalWeek(day.start)
          : new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
    );
    let bucket = result.at(-1);
    if (!bucket || bucket.key !== key) {
      bucket = {
        key,
        start: day.start,
        end: addDays(day.start, 1),
        days: 0,
        seconds: 0,
        sessionCount: 0,
        averageSeconds: 0,
        goalMetDays: 0,
        goalPercent: 0,
      };
      result.push(bucket);
    }
    bucket.end = addDays(day.start, 1);
    bucket.days++;
    bucket.seconds += day.seconds;
    bucket.sessionCount += day.sessionCount;
    if (Number.isFinite(dailyGoal) && dailyGoal > 0 && day.seconds >= dailyGoal) bucket.goalMetDays++;
    bucket.averageSeconds = bucket.sessionCount ? bucket.seconds / bucket.sessionCount : 0;
    bucket.goalPercent =
      Number.isFinite(dailyGoal) && dailyGoal > 0 ? (bucket.seconds / bucket.days / dailyGoal) * 100 : 0;
  }
  return result;
}

/** Trailing windows always use full calendar-day denominators and never future or visible-range-only data. */
export function rollingTimeline(history: FocusSession[], period: Period) {
  const points = calendarDailySeries(history, addDays(period.start, -364), period.end);
  const prefix = [0];
  for (const point of points) prefix.push(prefix.at(-1)! + point.seconds);
  return points.flatMap((point, index) => {
    const average = (days: number) => (prefix[index + 1] - prefix[Math.max(0, index + 1 - days)]) / days;
    return point.start < period.start
      ? []
      : [{ ...point, avg7: average(7), avg30: average(30), avg90: average(90), avg365: average(365) }];
  });
}

export function summaryMetrics(sessions: FocusSession[]) {
  const seconds = totalFocusedSeconds(sessions),
    days = dailyTotals(sessions).length;
  return [seconds, sessions.length, sessions.length ? seconds / sessions.length : 0, days ? seconds / days : 0, days];
}

export function percentageChange(current: number, previous: number): number | undefined {
  return previous > 0 ? ((current - previous) / previous) * 100 : current === 0 ? 0 : undefined;
}

type RecordRun = { start: number; end: number; days: number; seconds: number };
export function personalBests(sessions: FocusSession[], period: Period) {
  const rows = filterSessions(sessions, period),
    days = dailyTotals(rows);
  const bestDay = days.reduce<(typeof days)[number] | undefined>(
    (best, day) => (!best || day.seconds > best.seconds ? day : best),
    undefined,
  );
  const longestSession = rows.reduce<FocusSession | undefined>(
    (best, s) => (!best || s.focusedDurationSeconds > best.focusedDurationSeconds ? s : best),
    undefined,
  );
  let run: RecordRun | undefined, longest: RecordRun | undefined, consecutive: RecordRun | undefined;
  for (const day of days) {
    run =
      run && run.end === day.start
        ? { ...run, end: addDays(day.start, 1), days: run.days + 1, seconds: run.seconds + day.seconds }
        : { start: day.start, end: addDays(day.start, 1), days: 1, seconds: day.seconds };
    if (!longest || run.days > longest.days) longest = run;
    if (!consecutive || run.seconds > consecutive.seconds) consecutive = run;
  }
  const bestWeek = calendarBuckets(rows, period, "weekly").reduce<CalendarBucket | undefined>(
    (best, week) => (week.seconds > (best?.seconds ?? 0) ? week : best),
    undefined,
  );
  return { bestDay, longestSession, longest, consecutive, bestWeek };
}

export function averageStudyPattern(sessions: FocusSession[], period: Period) {
  const matrix = timeOfDayMatrix(sessions);
  if (calendarDays(period) <= 7) return matrix;
  const counts = Array<number>(7).fill(0);
  for (let day = period.start; day < period.end; day = addDays(day, 1)) counts[(new Date(day).getDay() + 6) % 7]++;
  return matrix.map((row, index) => row.map((seconds) => seconds / Math.max(1, counts[index])));
}
