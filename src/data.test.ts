import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { FocusDatabase } from "./db";
import { formatDuration, formatDurationAxis } from "./data";

const opened: Dexie[] = [];
const database = () => {
  const value = new FocusDatabase(`focus-test-${crypto.randomUUID()}`);
  opened.push(value);
  return value;
};

afterEach(async () => {
  await Promise.all(opened.splice(0).map((value) => value.delete()));
});

describe("V0.2 data management", () => {
  it("opens a fresh database without bundled study data", async () => {
    const testDb = database();
    expect(
      await Promise.all([
        testDb.academicYears.count(),
        testDb.subjects.count(),
        testDb.sessions.count(),
        testDb.settings.count(),
      ]),
    ).toEqual([0, 0, 0, 0]);
  });

  it("creates an Academic Year and Subject and filters archived Subjects", async () => {
    const testDb = database();
    await testDb.academicYears.add({ id: "year", name: "University Year 1", archived: false });
    await testDb.subjects.bulkAdd([
      { id: "maths", academicYearId: "year", name: "MATHS 120", color: "#4da3ff", archived: false },
      { id: "old", academicYearId: "year", name: "Old course", color: "#ff4d57", archived: true },
    ]);
    const subjects = (await testDb.subjects.where("academicYearId").equals("year").toArray()).filter(
      (subject) => !subject.archived,
    );
    expect(subjects.map((subject) => subject.name)).toEqual(["MATHS 120"]);
  });

  it("archives and restores a completed Session without losing data", async () => {
    const testDb = database();
    await testDb.sessions.add({
      id: "session",
      subjectId: "maths",
      subjectName: "MATHS 120",
      academicYearId: "year",
      academicYearName: "University Year 1",
      startTime: 1_000,
      endTime: 3_601_000,
      focusedDurationSeconds: 3600,
      archived: false,
    });
    await testDb.sessions.update("session", { archived: true });
    expect((await testDb.sessions.get("session"))?.archived).toBe(true);
    await testDb.sessions.update("session", { archived: false });
    expect(await testDb.sessions.get("session")).toMatchObject({
      subjectName: "MATHS 120",
      focusedDurationSeconds: 3600,
      archived: false,
    });
  });

  it("formats duration consistently for manual Sessions", () => {
    expect(formatDuration(4515)).toBe("1 hr 15 min");
    const startTime = Date.UTC(2026, 8, 21, 10);
    const endTime = Date.UTC(2026, 8, 21, 11, 15);
    expect(Math.round((endTime - startTime) / 1000)).toBe(4500);
  });

  it("formats chart axes in seconds, minutes, and hours", () => {
    expect(formatDurationAxis(21)).toBe("21 sec");
    expect(formatDurationAxis(300)).toBe("5 min");
    expect(formatDurationAxis(4500)).toBe("1.3 hr");
  });

  it("migrates V0.1 Sessions without deleting them", async () => {
    const name = `focus-migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    opened.push(legacy);
    legacy.version(1).stores({
      academicYears: "id, name, startDate, endDate, archived",
      subjects: "id, academicYearId, name, archived",
      sessions: "id, subjectId, startTime, endTime, archived",
    });
    await legacy
      .table("sessions")
      .add({ id: "legacy", subjectId: "physics", startTime: 1_000, endTime: 61_000, archived: false });
    legacy.close();
    const upgraded = new FocusDatabase(name);
    opened.push(upgraded);
    expect(await upgraded.sessions.get("legacy")).toMatchObject({
      id: "legacy",
      focusedDurationSeconds: 60,
      subjectName: "Unknown subject",
    });
  });
});
