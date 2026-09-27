import { db } from "./db";
import type { AcademicYear, FocusSession, Subject } from "./types";
import { localeCode } from "./i18n";

export const CURRENT_YEAR_KEY = "currentAcademicYearId";
export const makeId = () => crypto.randomUUID();

export function formatDurationForLocale(totalSeconds: number, locale = localeCode()) {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const number = new Intl.NumberFormat(locale);
  const units =
    locale === "zh-CN"
      ? ["小时", "分钟", "秒"]
      : locale === "zh-TW"
        ? ["小時", "分鐘", "秒"]
        : locale === "ja"
          ? ["時間", "分", "秒"]
          : ["hr", "min", "sec"];
  if (hours && minutes) return `${number.format(hours)} ${units[0]} ${number.format(minutes)} ${units[1]}`;
  if (hours) return `${number.format(hours)} ${units[0]}`;
  if (minutes) return `${number.format(minutes)} ${units[1]}`;
  return `${number.format(total)} ${units[2]}`;
}

export function formatDuration(totalSeconds: number) {
  return formatDurationForLocale(totalSeconds);
}

export function formatDurationAxisForLocale(totalSeconds: number, locale = localeCode()) {
  const total = Math.max(0, totalSeconds);
  const units =
    locale === "zh-CN"
      ? ["小时", "分钟", "秒"]
      : locale === "zh-TW"
        ? ["小時", "分鐘", "秒"]
        : locale === "ja"
          ? ["時間", "分", "秒"]
          : ["hr", "min", "sec"];
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (total < 60) return `${number.format(Math.round(total))} ${units[2]}`;
  if (total < 3600) return `${number.format(Math.round(total / 60))} ${units[1]}`;
  const hours = total / 3600;
  return `${number.format(hours < 10 && !Number.isInteger(hours) ? hours : Math.round(hours))} ${units[0]}`;
}

export function formatDurationAxis(totalSeconds: number) {
  return formatDurationAxisForLocale(totalSeconds);
}

export async function getCurrentAcademicYearId() {
  return (await db.settings.get(CURRENT_YEAR_KEY))?.value ?? "";
}

export async function setCurrentAcademicYear(id: string) {
  const year = await db.academicYears.get(id);
  if (!year || year.archived) throw new Error("Only an active academic year can be current.");
  await db.settings.put({ key: CURRENT_YEAR_KEY, value: id });
}

export async function createSession(input: {
  subject: Subject;
  academicYear: AcademicYear;
  startTime: number;
  endTime: number;
  note?: string;
  focusedDurationSeconds?: number;
  durationMode?: "locked" | "unlocked";
}) {
  if (!Number.isFinite(input.startTime) || !Number.isFinite(input.endTime) || input.endTime <= input.startTime) {
    throw new Error("End time must be after start time.");
  }
  if (input.subject.academicYearId !== input.academicYear.id)
    throw new Error("Choose a Subject from the selected Academic Year.");
  const spanSeconds = Math.round((input.endTime - input.startTime) / 1000);
  const durationMode = input.durationMode ?? "locked";
  const focusedDurationSeconds =
    durationMode === "locked" ? spanSeconds : Math.round(input.focusedDurationSeconds ?? spanSeconds);
  if (focusedDurationSeconds <= 0 || focusedDurationSeconds > spanSeconds)
    throw new Error("Duration cannot exceed the available Start and End span.");
  const session: FocusSession = {
    id: makeId(),
    subjectId: input.subject.id,
    subjectName: input.subject.name,
    academicYearId: input.academicYear.id,
    academicYearName: input.academicYear.name,
    startTime: input.startTime,
    endTime: input.endTime,
    focusedDurationSeconds,
    durationMode,
    note: input.note?.trim() || undefined,
    archived: false,
  };
  await db.sessions.add(session);
  return session;
}
