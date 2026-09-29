import { dailyFocusAllocations } from "../sessionAllocation";
import metadata from "../../package.json";
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { FocusDatabase } from "../db";
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_KEYS, type FocusSettings } from "../settings";
import type { FocusSession } from "../types";
import { analyzeBackup, createBackup, restoreBackup, validateBackup } from "./backup";
import { escapeCsv, exportSessionsCsv, importCsvPreview, parseCsv, previewCsv } from "./csv";

const opened: Dexie[] = [];
const database = () => {
  const value = new FocusDatabase(`focus-v03-${crypto.randomUUID()}`);
  opened.push(value);
  return value;
};
afterEach(async () => {
  await Promise.all(opened.splice(0).map((value) => value.delete()));
});

async function seeded() {
  const value = database();
  await value.academicYears.add({ id: "year", name: "IB", archived: false });
  await value.subjects.add({
    id: "subject",
    academicYearId: "year",
    name: "Japanese, Intermediate",
    color: "#ff922b",
    archived: false,
  });
  await value.sessions.add({
    id: "session",
    academicYearId: "year",
    academicYearName: "IB",
    subjectId: "subject",
    subjectName: "Japanese, Intermediate",
    startTime: new Date(2026, 8, 21, 23, 45).getTime(),
    endTime: new Date(2026, 8, 22, 0, 30).getTime(),
    focusedDurationSeconds: 2700,
    note: 'Review "Section A", then Section B',
    archived: true,
  });
  await value.settings.bulkPut([
    { key: "currentAcademicYearId", value: "year" },
    { key: "theme", value: "dark" },
  ]);
  return value;
}

describe("Shunhen JSON backups", () => {
  it("serializes and restores all persistent data losslessly", async () => {
    const source = await seeded();
    const backup = validateBackup(JSON.parse(JSON.stringify(await createBackup(source))));
    const target = database();
    await restoreBackup(backup, "replace", "use-imported", target);
    expect(await target.academicYears.toArray()).toEqual(await source.academicYears.toArray());
    expect(await target.subjects.toArray()).toEqual(await source.subjects.toArray());
    expect(await target.sessions.toArray()).toEqual(await source.sessions.toArray());
    expect(await loadSettings(target)).toEqual(await loadSettings(source));
    expect((await target.settings.get("currentAcademicYearId"))?.value).toBe("year");
  });
  it("includes every canonical setting and restores representative values", async () => {
    const source = await seeded();
    const expected: FocusSettings = {
      ...DEFAULT_SETTINGS,
      displayName: "Alex & Sam",
      sidebarSubtitle: "Keep going!",
      language: "ja",
      theme: "light",
      startMaximized: false,
      launchAtStartup: true,
      fixedTimerDurationSeconds: 5430,
      dailyGoalEnabled: true,
      dailyGoalSeconds: 7200,
      completionSoundChoice: "bright",
      completionSoundVolume: 37,
      popoutSize: "large",
      popoutTransparency: 73,
      popoutDocked: true,
      popoutDockCorner: "bottom-left",
      popoutAutoHideEdge: "left",
      popoutDockAutoHide: true,
      popoutAutoHideDelaySeconds: 1.25,
      popoutAutoHideTabSize: "large",
      popoutAutoHideShowAccent: false,
      popoutAlwaysOnTop: false,
      accentColour: "miku",
      uiScale: "large",
      allowDirectActiveDeletion: true,
    };
    await source.settings.bulkPut(
      (Object.keys(SETTINGS_KEYS) as (keyof FocusSettings)[]).map((key) => ({
        key: SETTINGS_KEYS[key],
        value: String(expected[key]),
      })),
    );
    const backup = await createBackup(source);
    const backupKeys = new Set(backup.data.settings.map((setting) => setting.key));
    expect(Object.values(SETTINGS_KEYS).every((key) => backupKeys.has(key))).toBe(true);
    const target = database();
    await restoreBackup(backup, "replace", "use-imported", target);
    expect(await loadSettings(target)).toEqual(expected);
    expect((await target.settings.get("currentAcademicYearId"))?.value).toBe("year");
  });
  it("rejects unsupported versions and corrupt references", async () => {
    const backup = await createBackup(await seeded());
    expect(() => validateBackup({ ...backup, formatVersion: 99 })).toThrow(/Unsupported/);
    expect(() =>
      validateBackup({
        ...backup,
        data: { ...backup.data, subjects: [{ ...backup.data.subjects[0], academicYearId: "missing" }] },
      }),
    ).toThrow(/missing Academic Year/);
  });
  it("detects merge duplicates and conflicts without silently overwriting", async () => {
    const source = await seeded();
    const backup = await createBackup(source);
    const target = database();
    await restoreBackup(backup, "merge", "keep-existing", target);
    const expectedDuplicates =
      backup.data.academicYears.length +
      backup.data.subjects.length +
      backup.data.sessions.length +
      backup.data.settings.length;
    expect((await analyzeBackup(backup, target)).duplicates).toBe(expectedDuplicates);
    await target.subjects.update("subject", { name: "Local name" });
    const analysis = await analyzeBackup(backup, target);
    expect(analysis.conflicts).toBe(1);
    await restoreBackup(backup, "merge", "keep-existing", target);
    expect((await target.subjects.get("subject"))?.name).toBe("Local name");
  });
});

describe("Shunhen CSV", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(escapeCsv('Review "A",\nthen B')).toBe('"Review ""A"",\nthen B"');
    expect(parseCsv(`Name,Note\r\nSubject,${escapeCsv('Review "A",\nthen B')}`)).toMatchObject({
      records: [{ Name: "Subject", Note: 'Review "A",\nthen B' }],
    });
  });
  it("round-trips Shunhen CSV IDs, archived state, and midnight crossing", async () => {
    const source = await seeded();
    const session = (await source.sessions.toArray())[0];
    const csv = exportSessionsCsv([session]);
    const target = database();
    const preview = await previewCsv(csv, undefined, undefined, target);
    expect(preview.recognizedFocusCsv).toBe(true);
    expect(preview.rows[0].session).toMatchObject({ id: "session", archived: true, focusedDurationSeconds: 2700 });
    expect(new Date(preview.rows[0].session!.endTime).getDate()).not.toBe(
      new Date(preview.rows[0].session!.startTime).getDate(),
    );
    const result = await importCsvPreview(preview, target);
    expect(result).toMatchObject({ academicYearsCreated: 1, subjectsCreated: 1, sessionsImported: 1 });
  });
  it("maps generic duration CSV and reports invalid rows", async () => {
    const target = database();
    await target.academicYears.add({ id: "year", name: "University Year 1", archived: false });
    const csv =
      "Year,Course,Date,Time,Minutes\nUniversity Year 1,ELECTENG 101,2026-09-21,09:00,60\nUniversity Year 1,ELECTENG 101,bad,09:00,-5";
    const preview = await previewCsv(
      csv,
      { academicYear: "Year", subject: "Course", startDate: "Date", startTime: "Time", focusedMinutes: "Minutes" },
      undefined,
      target,
    );
    expect(preview.subjectsToCreate).toEqual([{ academicYearName: "University Year 1", subjectName: "ELECTENG 101" }]);
    expect(preview.rows.filter((row) => row.errors.length)).toHaveLength(1);
    const result = await importCsvPreview(preview, target);
    expect(result).toMatchObject({ sessionsImported: 1, invalidRowsSkipped: 1 });
  });
  it("skips fingerprint duplicates when generic CSV has no ID", async () => {
    const target = await seeded();
    const session = (await target.sessions.toArray())[0] as FocusSession;
    const start = new Date(session.startTime),
      end = new Date(session.endTime);
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const csv = `Year,Subject,Start Date,Start Time,End Date,End Time\nIB,"Japanese, Intermediate",${date(start)},${time(start)},${date(end)},${time(end)}`;
    const preview = await previewCsv(
      csv,
      {
        academicYear: "Year",
        subject: "Subject",
        startDate: "Start Date",
        startTime: "Start Time",
        endDate: "End Date",
        endTime: "End Time",
      },
      undefined,
      target,
    );
    expect(preview.rows[0].duplicate).toBe(true);
  });
});

it("uses the release version without changing schema or rejecting older backup producers", async () => {
  const source = await seeded();
  await source.settings.put({ key: "dateFormat", value: "standard" });
  await source.settings.put({ key: "language", value: "ja" });
  const backup = await createBackup(source);
  expect(backup.appVersion).toBe(metadata.version);
  expect(backup.formatVersion).toBe(1);
  for (const mode of ["replace", "merge"] as const) {
    const target = database();
    await restoreBackup(validateBackup({ ...backup, appVersion: "1.2.0" }), mode, "use-imported", target);
    expect((await loadSettings(target)).dateFormat).toBe("standard");
    await target.settings.put({ key: "language", value: "en" });
    expect((await loadSettings(target)).dateFormat).toBe("standard");
    await target.settings.put({ key: "dateFormat", value: "compact" });
    expect((await loadSettings(target)).dateFormat).toBe("compact");
  }
});

it.each(["replace", "merge"] as const)(
  "normalizes imported F-key shortcuts during %s without changing conflict policy",
  async (mode) => {
    const source = await seeded(),
      target = database();
    const backup = await createBackup(source);
    backup.appVersion = "2.0.0";
    backup.data.settings = backup.data.settings.filter((row) => row.key !== "popoutRevealShortcut");
    backup.data.settings.push({ key: "popoutRevealShortcut", value: "Ctrl+F8" });
    await restoreBackup(validateBackup(backup), mode, "use-imported", target);
    expect((await target.settings.get("popoutRevealShortcut"))?.value).toBe("Ctrl+Alt+KeyF");
    await target.settings.put({ key: "popoutRevealShortcut", value: "Ctrl+KeyF" });
    await restoreBackup(backup, "merge", "keep-existing", target);
    expect((await target.settings.get("popoutRevealShortcut"))?.value).toBe("Ctrl+KeyF");
  },
);

it("normalizes incoming legacy notes without modifying the backup", async () => {
  const source = await seeded();
  const backup = await createBackup(source);
  backup.data.sessions[0].note = "😀".repeat(1201);
  const target = database();
  await restoreBackup(backup, "replace", "use-imported", target);
  expect(Array.from((await target.sessions.get("session"))!.note!)).toHaveLength(1200);
  expect(Array.from(backup.data.sessions[0].note)).toHaveLength(1201);
});
it("normalizes oversized notes once when upgrading an older database", async () => {
  const name = `note-migration-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  old.version(2).stores({ academicYears: "id", subjects: "id", sessions: "id", settings: "key" });
  await old.table("sessions").put({ id: "legacy", note: "line\n".repeat(45) });
  await old.table("sessions").put({ id: "valid", note: "\n**Keep**\n" });
  old.close();
  const migrated = new FocusDatabase(name);
  opened.push(migrated);
  expect((await migrated.sessions.get("legacy"))!.note!.split("\n")).toHaveLength(40);
  expect((await migrated.sessions.get("valid"))!.note).toBe("\n**Keep**\n");
});

it("migrates only an exactly reconstructable legacy overnight split", async () => {
  const name = `session-split-migration-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  old.version(3).stores({ academicYears: "id", subjects: "id", sessions: "id", settings: "key" });
  const start = new Date(2026, 8, 21, 23, 30).getTime();
  const exact = {
    id: "exact",
    subjectId: "subject",
    subjectName: "Subject",
    academicYearId: "year",
    academicYearName: "Year",
    startTime: start,
    endTime: start + 7200_000,
    focusedDurationSeconds: 3600,
    archived: false,
    focusIntervals: [
      { startTime: start, endTime: start + 1800_000 },
      { startTime: start + 5400_000, endTime: start + 7200_000 },
    ],
  };
  await old.table("sessions").bulkPut([exact, { ...exact, id: "unknown", focusIntervals: undefined }]);
  old.close();
  const migrated = new FocusDatabase(name);
  opened.push(migrated);
  expect((await migrated.sessions.get("exact"))?.focusedAfterMidnightSeconds).toBe(1800);
  expect((await migrated.sessions.get("unknown"))?.focusedAfterMidnightSeconds).toBeUndefined();
});

it("normalizes oversized CSV notes without rejecting their Sessions", async () => {
  const source = await seeded();
  const rows = await source.sessions.toArray();
  rows[0].note = "text\n".repeat(45);
  const target = database();
  const preview = await previewCsv(exportSessionsCsv(rows), undefined, undefined, target);
  await importCsvPreview(preview, target);
  expect((await target.sessions.get("session"))!.note!.split("\n")).toHaveLength(40);
});

it("preserves imported out-of-year sessions and reports only applied invalid imports", async () => {
  const source = await seeded();
  await source.academicYears.update("year", { startDate: "2026-09-01", endDate: "2026-09-21" });
  const backup = await createBackup(source),
    target = database();
  const result = await restoreBackup(backup, "merge", "keep-existing", target);
  expect(result.invalidSessionsImported).toBe(1);
  expect(await target.sessions.count()).toBe(1);
  const duplicate = await restoreBackup(backup, "merge", "keep-existing", target);
  expect(duplicate.invalidSessionsImported ?? 0).toBe(0);
  const csvTarget = database();
  await csvTarget.academicYears.bulkAdd(await source.academicYears.toArray());
  await csvTarget.subjects.bulkAdd(await source.subjects.toArray());
  const preview = await previewCsv(exportSessionsCsv(await source.sessions.toArray()), undefined, undefined, csvTarget);
  expect((await importCsvPreview(preview, csvTarget)).invalidSessionsImported).toBe(1);
});

it("imports malformed optional intervals without crashing Analytics and preserves valid intervals", async () => {
  const source = await seeded();
  for (const intervals of [
    [null],
    {},
    [{ startTime: new Date(2026, 8, 21, 23, 45).getTime(), endTime: new Date(2026, 8, 22, 0, 30).getTime() }],
  ]) {
    const raw = await createBackup(source);
    (raw.data.sessions[0] as unknown as { focusIntervals: unknown }).focusIntervals = intervals;
    const backup = validateBackup(JSON.parse(JSON.stringify(raw)));
    const target = database();
    await restoreBackup(backup, "replace", "use-imported", target);
    const imported = (await target.sessions.toArray())[0];
    expect(dailyFocusAllocations(imported).reduce((sum, part) => sum + part.seconds, 0)).toBe(
      Array.isArray(intervals) && intervals[0] !== null ? 2700 : 0,
    );
    expect(imported.focusIntervals).toEqual(intervals);
  }
});

it("preserves explicit overnight summaries and focused duration through CSV", async () => {
  const source = await seeded();
  await source.sessions.update("session", { focusedDurationSeconds: 1200, focusedAfterMidnightSeconds: 600 });
  const target = database();
  const preview = await previewCsv(exportSessionsCsv(await source.sessions.toArray()), undefined, undefined, target);
  const result = await importCsvPreview(preview, target);
  expect(result.invalidSessionsImported ?? 0).toBe(0);
  expect(await target.sessions.get("session")).toMatchObject({
    focusedDurationSeconds: 1200,
    focusedAfterMidnightSeconds: 600,
  });
});
