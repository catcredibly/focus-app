import type { AcademicYear } from "../types";
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
export function goalAggregationModes(_range: AnalyticsRange, _days: number): Aggregation[] {
  return ["daily", "weekly", "monthly"];
}
export function goalDefaultAggregation(_range: AnalyticsRange, days: number, mode: "daily" | "weekly" = "daily"): Aggregation {
  return days > 180 ? "monthly" : mode === "daily" && days <= 31 ? "daily" : "weekly";
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

export function analyticsPeriod(
  range: AnalyticsRange,
  sessions: FocusSession[],
  now: number,
  custom?: Period,
  year?: AcademicYear,
): Period {
  const today = startOfLocalDay(now);
  if (range === "Custom" && custom) return custom;
  const yearStart = year?.startDate ? new Date(`${year.startDate}T00:00:00`).getTime() : undefined;
  const yearEnd = year?.endDate ? new Date(`${year.endDate}T00:00:00`).getTime() : undefined;
  if (yearStart !== undefined && yearStart > today) return { start: today, end: today };
  const end = addDays(yearEnd !== undefined ? Math.min(yearEnd, today) : today, 1);
  if (range === "All")
    return {
      start: yearStart ?? sessions.reduce((first, s) => Math.min(first, startOfLocalDay(s.startTime)), today),
      end,
    };
  const days = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
  return { start: Math.max(addDays(end, -days), yearStart ?? -Infinity), end };
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
  const startedTotals = new Map<string, { seconds: number; count: number }>();
  for (const session of sessions) {
    const key = localDayKey(session.startTime),
      value = startedTotals.get(key) ?? { seconds: 0, count: 0 };
    value.seconds += session.focusedDurationSeconds;
    value.count++;
    startedTotals.set(key, value);
  }
  let bucketSessionSeconds = 0, progressTotal = 0;
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
      bucketSessionSeconds = 0;
      progressTotal = 0;
    }
    bucket.end = addDays(day.start, 1);
    bucket.days++;
    bucket.seconds += day.seconds;
    bucket.sessionCount += day.sessionCount;
    if (Number.isFinite(dailyGoal) && dailyGoal > 0 && day.seconds >= dailyGoal) bucket.goalMetDays++;
    bucketSessionSeconds += startedTotals.get(day.key)?.seconds ?? 0;
    bucket.averageSeconds = bucket.sessionCount ? bucketSessionSeconds / bucket.sessionCount : 0;
    if (Number.isFinite(dailyGoal) && dailyGoal > 0) progressTotal += Math.min(1, day.seconds / dailyGoal);
    bucket.goalPercent = (progressTotal / bucket.days) * 100;
  }
  return result;
}

/** Trailing windows include zero days after the first Session, never artificial pre-history days. */
export function rollingTimeline(history: FocusSession[], period: Period) {
  const first = history.reduce((value, session) => Math.min(value, startOfLocalDay(session.startTime)), Infinity);
  const points = calendarDailySeries(history, addDays(period.start, -364), period.end);
  const prefix = [0];
  for (const point of points) prefix.push(prefix.at(-1)! + point.seconds);
  return points.flatMap((point, index) => {
    const average = (days: number) =>
      point.start < first
        ? null
        : (prefix[index + 1] - prefix[Math.max(0, index + 1 - days)]) /
          Math.min(days, calendarDays({ start: first, end: addDays(point.start, 1) }));
    return point.start < period.start
      ? []
      : [{ ...point, avg7: average(7), avg30: average(30), avg90: average(90), avg365: average(365) }];
  });
}

export function summaryMetrics(sessions: FocusSession[], period?: Period) {
  const started = period ? filterSessions(sessions, period) : sessions;
  const daily = dailyTotals(sessions).filter(
    (day) => day.seconds > 0 && (!period || (day.start >= period.start && day.start < period.end)),
  );
  const seconds = daily.reduce((sum, day) => sum + day.seconds, 0),
    days = daily.length;
  return [
    seconds,
    started.length,
    started.length ? totalFocusedSeconds(started) / started.length : 0,
    days ? seconds / days : 0,
    days,
  ];
}

export function percentageChange(current: number, previous: number): number | undefined {
  return previous > 0 ? ((current - previous) / previous) * 100 : current === 0 ? 0 : undefined;
}

type RecordRun = { start: number; end: number; days: number; seconds: number };
export function personalBests(sessions: FocusSession[], period: Period) {
  const rows = filterSessions(sessions, period),
    days = dailyTotals(sessions).filter(
      (day) => day.seconds > 0 && day.start >= period.start && day.start < period.end,
    );
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
  const bestWeek = calendarBuckets(sessions, period, "weekly").reduce<CalendarBucket | undefined>(
    (best, week) => (week.seconds > (best?.seconds ?? 0) ? week : best),
    undefined,
  );
  return { bestDay, longestSession, longest, consecutive, bestWeek };
}

export function averageStudyPattern(sessions: FocusSession[], period: Period) {
  const matrix = timeOfDayMatrix(sessions, period);
  if (calendarDays(period) <= 7) return matrix;
  const counts = Array<number>(7).fill(0);
  for (let day = period.start; day < period.end; day = addDays(day, 1)) counts[(new Date(day).getDay() + 6) % 7]++;
  return matrix.map((row, index) => row.map((seconds) => seconds / Math.max(1, counts[index])));
}

/** Daily data stays intact; only axis labels are sampled to fit the viewport. */
export function cumulativeDailyFocus(sessions: FocusSession[], period: Period) {
  let total = 0;
  return calendarBuckets(sessions, period, "daily").map(point => ({ ...point, cumulativeSeconds: (total += point.seconds) }));
}
export function dailyTickIndices(count: number, width: number): number[] {
  if (count <= 0) return [];
  const step = Math.max(1, Math.ceil((count - 1) / Math.max(1, Math.floor(width / 100) - 1)));
  const ticks = Array.from({ length: Math.ceil((count - 1) / step) }, (_, i) => i * step);
  return [...ticks, count - 1];
}
