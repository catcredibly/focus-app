import type { AcademicYear, Subject } from "../types";
import type { Aggregation } from "./periods";
export const NO_CURRENT_YEAR = "__unselected";
export const DEFAULT_WEEKDAY_METRIC = "seconds";
export function initialAnalyticsYear(years: AcademicYear[], current: string) {
  return years.some((year) => year.id === current && !year.archived) ? current : NO_CURRENT_YEAR;
}
export function groupedByArchive<T extends { archived: boolean }>(values: T[]) {
  return [...values].sort((a, b) => Number(a.archived) - Number(b.archived));
}
export function subjectsForYear(subjects: Subject[], yearId: string) {
  return groupedByArchive(subjects.filter((subject) => subject.academicYearId === yearId));
}
export function availableGoalMode(daily: boolean, weekly: boolean, selected: "daily" | "weekly") {
  return daily && weekly ? selected : weekly ? "weekly" : "daily";
}
export function compatibleGoalGrouping(mode: "daily" | "weekly", grouping: Aggregation): Aggregation {
  return mode === "weekly" && grouping === "daily" ? "weekly" : grouping;
}
