import { normalizeNote } from "../notes";
import { db, type FocusDatabase } from "../db";
import { makeId } from "../data";
import type { AcademicYear, FocusSession, Subject } from "../types";
import type { CsvMapping, CsvPreview, CsvPreviewRow, ImportSummary } from "./types";

export const FOCUS_CSV_HEADERS = [
  "Session ID",
  "Academic Year",
  "Subject",
  "Start Date",
  "Start Time",
  "End Date",
  "End Time",
  "Focused Minutes",
  "Archived",
  "Note",
];
const pad = (value: number) => String(value).padStart(2, "0");
const localParts = (stamp: number) => {
  const d = new Date(stamp);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
};
export const escapeCsv = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function exportSessionsCsv(sessions: FocusSession[]) {
  const lines = [FOCUS_CSV_HEADERS.map(escapeCsv).join(",")];
  for (const session of sessions) {
    const start = localParts(session.startTime),
      end = localParts(session.endTime);
    lines.push(
      [
        session.id,
        session.academicYearName,
        session.subjectName,
        start.date,
        start.time,
        end.date,
        end.time,
        session.focusedDurationSeconds / 60,
        session.archived,
        session.note ?? "",
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted value.");
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length || !rows[0].some(Boolean)) throw new Error("CSV is empty.");
  const headers = rows[0].map((h) => h.trim());
  return {
    headers,
    records: rows
      .slice(1)
      .filter((r) => r.some((v) => v.trim()))
      .map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]))),
  };
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();
export function detectMapping(headers: string[]): CsvMapping {
  const find = (...names: string[]) => headers.find((h) => names.includes(normalize(h)));
  return {
    sessionId: find("session id", "id"),
    academicYear: find("academic year", "academic year name", "year"),
    subject: find("subject", "subject name"),
    startDate: find("start date", "date"),
    startTime: find("start time"),
    endDate: find("end date"),
    endTime: find("end time"),
    startDateTime: find("start datetime", "start", "started at"),
    endDateTime: find("end datetime", "end", "ended at"),
    focusedMinutes: find("focused minutes", "duration", "duration minutes", "minutes"),
    note: find("note", "notes"),
    archived: find("archived"),
  };
}
const combine = (date?: string, time?: string) =>
  date && time ? new Date(`${date.trim()}T${time.trim()}`).getTime() : NaN;
const bool = (value: string) => ["true", "yes", "1", "archived"].includes(normalize(value));
export const sessionFingerprint = (
  s: Pick<FocusSession, "academicYearId" | "subjectId" | "startTime" | "endTime" | "focusedDurationSeconds">,
) => [s.academicYearId, s.subjectId, s.startTime, s.endTime, s.focusedDurationSeconds].join("|");

export async function previewCsv(
  text: string,
  mappingOverride?: CsvMapping,
  destinationYearId?: string,
  database: FocusDatabase = db,
): Promise<CsvPreview> {
  const parsed = parseCsv(text),
    detected = detectMapping(parsed.headers),
    mapping = { ...detected, ...mappingOverride };
  const recognizedFocusCsv = FOCUS_CSV_HEADERS.every((h) => parsed.headers.includes(h));
  const years = await database.academicYears.toArray(),
    subjects = await database.subjects.toArray(),
    existingSessions = await database.sessions.toArray();
  const yearByName = new Map(years.map((y) => [normalize(y.name), y])),
    subjectByPair = new Map(subjects.map((s) => [`${s.academicYearId}|${normalize(s.name)}`, s]));
  const existingIds = new Map(existingSessions.map((s) => [s.id, s])),
    fingerprints = new Set(existingSessions.map(sessionFingerprint));
  const academicYearsToCreate = new Set<string>(),
    subjectsToCreate = new Map<string, { academicYearName: string; subjectName: string }>();
  const rows: CsvPreviewRow[] = parsed.records.map((record, index) => {
    const errors: string[] = [];
    const academicYearName = mapping.academicYear
      ? record[mapping.academicYear]?.trim()
      : years.find((y) => y.id === destinationYearId)?.name;
    const subjectName = mapping.subject ? record[mapping.subject]?.trim() : "";
    if (!academicYearName) errors.push("Academic Year is required.");
    if (!subjectName) errors.push("Subject is required.");
    let year = academicYearName ? yearByName.get(normalize(academicYearName)) : undefined;
    if (academicYearName && !year) {
      year = {
        id: `import-year-${normalize(academicYearName).replace(/[^a-z0-9]+/g, "-")}`,
        name: academicYearName,
        archived: false,
      };
      academicYearsToCreate.add(academicYearName);
      yearByName.set(normalize(academicYearName), year);
    }
    let subject = year && subjectName ? subjectByPair.get(`${year.id}|${normalize(subjectName)}`) : undefined;
    if (year && subjectName && !subject) {
      subject = {
        id: `import-subject-${year.id}-${normalize(subjectName).replace(/[^a-z0-9]+/g, "-")}`,
        academicYearId: year.id,
        name: subjectName,
        color: "#4da3ff",
        archived: false,
      };
      subjectByPair.set(`${year.id}|${normalize(subjectName)}`, subject);
      subjectsToCreate.set(subject.id, { academicYearName: year.name, subjectName });
    }
    let startTime = mapping.startDateTime
      ? new Date(record[mapping.startDateTime]).getTime()
      : combine(
          mapping.startDate ? record[mapping.startDate] : undefined,
          mapping.startTime ? record[mapping.startTime] : undefined,
        );
    let endTime = mapping.endDateTime
      ? new Date(record[mapping.endDateTime]).getTime()
      : combine(
          mapping.endDate ? record[mapping.endDate] : mapping.startDate ? record[mapping.startDate] : undefined,
          mapping.endTime ? record[mapping.endTime] : undefined,
        );
    const minutes = mapping.focusedMinutes ? Number(record[mapping.focusedMinutes]) : NaN;
    if (!Number.isFinite(endTime) && Number.isFinite(startTime) && minutes > 0) endTime = startTime + minutes * 60000;
    if (!Number.isFinite(startTime)) errors.push("Valid start date and time are required.");
    if (!Number.isFinite(endTime)) errors.push("End time or duration is required.");
    if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime <= startTime)
      errors.push("End must be after start.");
    let session: FocusSession | undefined;
    let duplicate = false;
    if (!errors.length && year && subject) {
      const id = (mapping.sessionId && record[mapping.sessionId]?.trim()) || makeId();
      session = {
        id,
        academicYearId: year.id,
        academicYearName: year.name,
        subjectId: subject.id,
        subjectName: subject.name,
        startTime,
        endTime,
        focusedDurationSeconds: Math.round((endTime - startTime) / 1000),
        archived: mapping.archived ? bool(record[mapping.archived]) : false,
        note: mapping.note ? normalizeNote(record[mapping.note] ?? "") || undefined : undefined,
      };
      const existing = existingIds.get(id);
      duplicate = existing
        ? JSON.stringify(existing) === JSON.stringify(session)
        : fingerprints.has(sessionFingerprint(session));
      if (existing && !duplicate) errors.push("Session ID conflicts with an existing record.");
    }
    return { rowNumber: index + 2, session, academicYearName, subjectName, errors, duplicate };
  });
  return {
    headers: parsed.headers,
    rows,
    mapping,
    recognizedFocusCsv,
    academicYearsToCreate: [...academicYearsToCreate],
    subjectsToCreate: [...subjectsToCreate.values()],
  };
}

export async function importCsvPreview(preview: CsvPreview, database: FocusDatabase = db): Promise<ImportSummary> {
  const summary: ImportSummary = {
    academicYearsCreated: 0,
    subjectsCreated: 0,
    sessionsImported: 0,
    duplicatesSkipped: preview.rows.filter((r) => r.duplicate).length,
    conflicts: preview.rows.filter((r) => r.errors.some((e) => e.includes("conflicts"))).length,
    invalidRowsSkipped: preview.rows.filter((r) => r.errors.length > 0).length,
  };
  await database.transaction("rw", database.academicYears, database.subjects, database.sessions, async () => {
    for (const row of preview.rows) {
      if (!row.session || row.duplicate || row.errors.length) continue;
      if (!(await database.academicYears.get(row.session.academicYearId))) {
        await database.academicYears.add({
          id: row.session.academicYearId,
          name: row.session.academicYearName,
          archived: false,
        });
        summary.academicYearsCreated++;
      }
      if (!(await database.subjects.get(row.session.subjectId))) {
        await database.subjects.add({
          id: row.session.subjectId,
          academicYearId: row.session.academicYearId,
          name: row.session.subjectName,
          color: "#4da3ff",
          archived: false,
        });
        summary.subjectsCreated++;
      }
      await database.sessions.add({
        ...row.session,
        note: row.session.note === undefined ? undefined : normalizeNote(row.session.note),
      });
      summary.sessionsImported++;
    }
  });
  return summary;
}
