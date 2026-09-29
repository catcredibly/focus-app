import type { AcademicYear, FocusSession } from "../types";
import { dailyTotals, startOfLocalDay } from "./analytics";
import { addDays, calendarDays } from "./periods";

export function academicYearProgress(years: AcademicYear[], sessions: FocusSession[], now = Date.now()) {
  const today = startOfLocalDay(now);
  return years.flatMap((year) => {
    const start = year.startDate ? new Date(year.startDate + "T00:00:00").getTime() : NaN;
    const last = year.endDate ? new Date(year.endDate + "T00:00:00").getTime() : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(last) || last < start || start > today) return [];
    const end = addDays(last, 1),
      elapsedEnd = Math.min(end, addDays(today, 1));
    const totalDays = calendarDays({ start, end }),
      elapsedDays = calendarDays({ start, end: elapsedEnd });
    const days = dailyTotals(sessions.filter((session) => session.academicYearId === year.id));
    const totals = new Map(days.map((day) => [day.start, day.seconds]));
    let seconds = 0;
    const points = [{ progress: 0, seconds: 0, elapsedDays: 0, totalDays }];
    for (let day = start, elapsed = 1; day < elapsedEnd; day = addDays(day, 1), elapsed++) {
      seconds += totals.get(day) ?? 0;
      points.push({ progress: (elapsed / totalDays) * 100, seconds, elapsedDays: elapsed, totalDays });
    }
    const activeDays = days.filter((day) => day.seconds > 0 && day.start >= start && day.start < elapsedEnd).length;
    return [
      {
        year,
        activeDays,
        points,
        totalDays,
        elapsedDays,
        progress: (elapsedDays / totalDays) * 100,
        ongoing: last > today,
        activeDayRate: activeDays / elapsedDays,
      },
    ];
  });
}
