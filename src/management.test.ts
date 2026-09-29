import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { FocusDatabase } from "./db";
import {
  canDeleteManagedRecord,
  deleteAcademicYearCascade,
  deleteSession,
  deleteSessions,
  deleteSubjectCascade,
  isSessionEffectivelyArchived,
  moveSessions,
  setAcademicYearArchived,
  updateSessionDetails,
  saveSessionEdit,
  saveAcademicYearEdit,
} from "./management";
import { managementViewState } from "./managementViewState";

const opened: Dexie[] = [];
const database = () => {
  const value = new FocusDatabase(`focus-management-${crypto.randomUUID()}`);
  opened.push(value);
  return value;
};
afterEach(async () => {
  await Promise.all(opened.splice(0).map((value) => value.delete()));
});

describe("management archive and deletion integrity", () => {
  it("derives Session archive status from its Subject and Academic Year", () => {
    const session = {
      id: "session",
      subjectId: "subject",
      subjectName: "Subject",
      academicYearId: "year",
      academicYearName: "Year",
      startTime: 1,
      endTime: 2,
      focusedDurationSeconds: 1,
      archived: true,
    };
    const subject = { id: "subject", academicYearId: "year", name: "Subject", color: "#fff", archived: false };
    const year = { id: "year", name: "Year", archived: false };
    expect(isSessionEffectivelyArchived(session, [subject], [year])).toBe(false);
    expect(isSessionEffectivelyArchived(session, [{ ...subject, archived: true }], [year])).toBe(true);
    expect(isSessionEffectivelyArchived(session, [subject], [{ ...year, archived: true }])).toBe(true);
  });
  it("retains management view selections while pages unmount and remount", () => {
    managementViewState.academicYearsArchived = true;
    managementViewState.subjectsArchived = true;
    managementViewState.historyStatus = "archived";
    expect(managementViewState).toEqual({
      academicYearsArchived: true,
      subjectsArchived: true,
      historyStatus: "archived",
    });
    managementViewState.academicYearsArchived = false;
    managementViewState.subjectsArchived = false;
    managementViewState.historyStatus = "active";
  });
  it("moves an Academic Year between Active and Archived without deleting related data", async () => {
    const testDb = database();
    await testDb.academicYears.add({ id: "year", name: "Year", archived: false });
    await testDb.subjects.add({
      id: "subject",
      academicYearId: "year",
      name: "Subject",
      color: "#fff",
      archived: false,
    });
    await testDb.sessions.add({
      id: "session",
      subjectId: "subject",
      subjectName: "Subject",
      academicYearId: "year",
      academicYearName: "Year",
      startTime: 1,
      endTime: 2,
      focusedDurationSeconds: 1,
      archived: false,
    });
    await setAcademicYearArchived("year", true, testDb);
    expect((await testDb.academicYears.get("year"))?.archived).toBe(true);
    expect(await testDb.subjects.count()).toBe(1);
    expect(await testDb.sessions.count()).toBe(1);
    await setAcademicYearArchived("year", false, testDb);
    expect((await testDb.academicYears.get("year"))?.archived).toBe(false);
  });

  it("uses archive-first deletion visibility unless direct deletion is enabled", () => {
    expect(canDeleteManagedRecord(false, false)).toBe(false);
    expect(canDeleteManagedRecord(true, false)).toBe(true);
    expect(canDeleteManagedRecord(false, true)).toBe(true);
  });

  it("deletes a Subject and its Sessions while preserving unrelated records", async () => {
    const testDb = database();
    await testDb.subjects.bulkAdd([
      { id: "subject", academicYearId: "year", name: "Subject", color: "#fff", archived: true },
      { id: "other", academicYearId: "year", name: "Other", color: "#fff", archived: false },
    ]);
    await testDb.sessions.bulkAdd([
      {
        id: "session",
        subjectId: "subject",
        subjectName: "Subject",
        academicYearId: "year",
        academicYearName: "Year",
        startTime: 1,
        endTime: 2,
        focusedDurationSeconds: 1,
        archived: false,
      },
      {
        id: "other-session",
        subjectId: "other",
        subjectName: "Other",
        academicYearId: "year",
        academicYearName: "Year",
        startTime: 1,
        endTime: 3,
        focusedDurationSeconds: 2,
        archived: false,
      },
    ]);
    await deleteSubjectCascade("subject", testDb);
    expect(await testDb.subjects.get("subject")).toBeUndefined();
    expect(await testDb.sessions.get("session")).toBeUndefined();
    expect(await testDb.subjects.get("other")).toBeTruthy();
    expect(await testDb.sessions.get("other-session")).toBeTruthy();
  });

  it("deletes an Academic Year with all Subjects and Sessions atomically", async () => {
    const testDb = database();
    await testDb.academicYears.bulkAdd([
      { id: "year", name: "Year", archived: true },
      { id: "other-year", name: "Other Year", archived: false },
    ]);
    await testDb.subjects.bulkAdd([
      { id: "one", academicYearId: "year", name: "One", color: "#fff", archived: true },
      { id: "two", academicYearId: "year", name: "Two", color: "#fff", archived: true },
      { id: "other", academicYearId: "other-year", name: "Other", color: "#fff", archived: false },
    ]);
    const session = (id: string, subjectId: string, academicYearId: string) => ({
      id,
      subjectId,
      subjectName: subjectId,
      academicYearId,
      academicYearName: academicYearId,
      startTime: 1,
      endTime: 2,
      focusedDurationSeconds: 1,
      archived: false,
    });
    await testDb.sessions.bulkAdd([
      session("one-session", "one", "year"),
      session("two-session", "two", "year"),
      session("other-session", "other", "other-year"),
    ]);
    await deleteAcademicYearCascade("year", testDb);
    expect((await testDb.academicYears.toArray()).map((row) => row.id)).toEqual(["other-year"]);
    expect((await testDb.subjects.toArray()).map((row) => row.id)).toEqual(["other"]);
    expect((await testDb.sessions.toArray()).map((row) => row.id)).toEqual(["other-session"]);
  });

  it("bulk deletion removes exactly the selected Sessions", async () => {
    const testDb = database();
    const session = (id: string) => ({
      id,
      subjectId: "subject",
      subjectName: "Subject",
      academicYearId: "year",
      academicYearName: "Year",
      startTime: 1,
      endTime: 2,
      focusedDurationSeconds: 1,
      archived: false,
    });
    await testDb.sessions.bulkAdd([session("one"), session("two"), session("three")]);
    await deleteSessions(["one", "three"], testDb);
    expect((await testDb.sessions.toArray()).map((row) => row.id)).toEqual(["two"]);
    await deleteSession("two", testDb);
    expect(await testDb.sessions.count()).toBe(0);
  });

  it("moves selected Sessions without changing their study data", async () => {
    const testDb = database();
    await testDb.academicYears.add({ id: "year", name: "Year", archived: false });
    await testDb.subjects.bulkAdd([
      { id: "old", academicYearId: "year", name: "Old", color: "#fff", archived: false },
      { id: "new", academicYearId: "year", name: "New", color: "#fff", archived: false },
    ]);
    await testDb.sessions.bulkAdd([
      {
        id: "one",
        subjectId: "old",
        subjectName: "Old",
        academicYearId: "year",
        academicYearName: "Year",
        startTime: 10,
        endTime: 20,
        focusedDurationSeconds: 10,
        note: "Keep me",
        archived: true,
      },
      {
        id: "two",
        subjectId: "old",
        subjectName: "Old",
        academicYearId: "year",
        academicYearName: "Year",
        startTime: 20,
        endTime: 30,
        focusedDurationSeconds: 10,
        archived: false,
      },
    ]);
    await moveSessions(["one"], "new", testDb);
    expect(await testDb.sessions.get("one")).toMatchObject({
      subjectId: "new",
      subjectName: "New",
      startTime: 10,
      endTime: 20,
      focusedDurationSeconds: 10,
      note: "Keep me",
      archived: true,
    });
    expect((await testDb.sessions.get("two"))?.subjectId).toBe("old");
  });

  it("does not move Sessions to archived destinations", async () => {
    const testDb = database();
    await testDb.academicYears.add({ id: "year", name: "Year", archived: false });
    await testDb.subjects.add({
      id: "archived",
      academicYearId: "year",
      name: "Archived",
      color: "#fff",
      archived: true,
    });
    await expect(moveSessions(["one"], "archived", testDb)).rejects.toThrow("active Subject");
  });

  it("updates Session relationships and preserves an unlocked focused duration", async () => {
    const testDb = database();
    await testDb.academicYears.bulkAdd([
      { id: "old-year", name: "Old Year", archived: false },
      { id: "new-year", name: "New Year", archived: false },
    ]);
    await testDb.subjects.bulkAdd([
      { id: "old", academicYearId: "old-year", name: "Old", color: "#fff", archived: false },
      { id: "new", academicYearId: "new-year", name: "New", color: "#fff", archived: false },
    ]);
    await testDb.sessions.add({
      id: "session",
      subjectId: "old",
      subjectName: "Old",
      academicYearId: "old-year",
      academicYearName: "Old Year",
      startTime: 0,
      endTime: 7200000,
      focusedDurationSeconds: 5400,
      archived: false,
    });
    await updateSessionDetails(
      "session",
      {
        academicYearId: "new-year",
        subjectId: "new",
        startTime: 1800000,
        endTime: 7200000,
        focusedDurationSeconds: 4500,
        durationMode: "unlocked",
        note: "Updated",
      },
      testDb,
    );
    expect(await testDb.sessions.get("session")).toMatchObject({
      subjectId: "new",
      subjectName: "New",
      academicYearId: "new-year",
      academicYearName: "New Year",
      startTime: 1800000,
      endTime: 7200000,
      focusedDurationSeconds: 4500,
      durationMode: "unlocked",
      note: "Updated",
    });
  });

  it("rejects an unlocked duration longer than the Session span", async () => {
    const testDb = database();
    await testDb.academicYears.add({ id: "year", name: "Year", archived: false });
    await testDb.subjects.add({
      id: "subject",
      academicYearId: "year",
      name: "Subject",
      color: "#fff",
      archived: false,
    });
    await testDb.sessions.add({
      id: "session",
      subjectId: "subject",
      subjectName: "Subject",
      academicYearId: "year",
      academicYearName: "Year",
      startTime: 0,
      endTime: 3600000,
      focusedDurationSeconds: 3600,
      archived: false,
    });
    await expect(
      updateSessionDetails(
        "session",
        {
          academicYearId: "year",
          subjectId: "subject",
          startTime: 0,
          endTime: 3600000,
          focusedDurationSeconds: 5400,
          durationMode: "unlocked",
        },
        testDb,
      ),
    ).rejects.toThrow("cannot exceed");
    expect((await testDb.sessions.get("session"))?.focusedDurationSeconds).toBe(3600);
  });
});

it("corrects an invalid overnight Session only after a valid explicit split is saved", async () => {
  const testDb = database();
  await testDb.academicYears.add({ id: "year", name: "Year", archived: false });
  await testDb.subjects.add({
    id: "subject",
    academicYearId: "year",
    name: "Subject",
    color: "#fff",
    archived: false,
  });
  const startTime = new Date(2026, 8, 21, 23).getTime();
  const input = {
    academicYearId: "year",
    subjectId: "subject",
    startTime,
    endTime: startTime + 7200_000,
    focusedDurationSeconds: 3600,
    focusedAfterMidnightSeconds: 1800,
    durationMode: "unlocked" as const,
  };
  await testDb.sessions.add({
    id: "legacy",
    ...input,
    focusedAfterMidnightSeconds: undefined,
    subjectName: "Subject",
    academicYearName: "Year",
    archived: false,
  });
  await expect(updateSessionDetails("legacy", { ...input, focusedAfterMidnightSeconds: 4000 }, testDb)).rejects.toThrow(
    /fit within/,
  );
  expect(await saveSessionEdit("legacy", input, {}, testDb)).toBe("saved");
  expect((await testDb.sessions.get("legacy"))?.focusedAfterMidnightSeconds).toBe(1800);
});

it("preserves exact intervals for unrelated edits and removes them for timing edits", async () => {
  const testDb = database();
  await testDb.academicYears.add({ id: "y", name: "Year", archived: false });
  await testDb.subjects.add({ id: "s", academicYearId: "y", name: "Subject", color: "#fff", archived: false });
  const intervals = [
    { startTime: 1001, endTime: 61001 },
    { startTime: 63001, endTime: 123001 },
  ];
  await testDb.sessions.add({
    id: "session",
    academicYearId: "y",
    academicYearName: "Year",
    subjectId: "s",
    subjectName: "Subject",
    startTime: 1001,
    endTime: 123001,
    focusedDurationSeconds: 120,
    focusIntervals: intervals,
    archived: false,
  });
  const input = {
    academicYearId: "y",
    subjectId: "s",
    startTime: 1001,
    endTime: 123001,
    focusedDurationSeconds: 120,
    durationMode: "unlocked" as const,
    note: "Updated note",
  };
  await updateSessionDetails("session", input, testDb);
  expect((await testDb.sessions.get("session"))?.focusIntervals).toEqual(intervals);
  await updateSessionDetails("session", { ...input, endTime: 124001 }, testDb);
  expect((await testDb.sessions.get("session"))?.focusIntervals).toBeUndefined();
});

it("gates destructive timing edits and year-boundary edits before persistence", async () => {
  const databaseUnderTest = database();
  const year = { id: "y", name: "Year", archived: false, startDate: "2026-09-01", endDate: "2026-09-30" };
  await databaseUnderTest.academicYears.bulkAdd([year, { ...year, id: "other" }]);
  await databaseUnderTest.subjects.bulkAdd([
    { id: "s", academicYearId: "y", name: "Subject", color: "#fff", archived: false },
    { id: "s2", academicYearId: "y", name: "Second", color: "#fff", archived: false },
    { id: "s3", academicYearId: "other", name: "Subject", color: "#fff", archived: false },
  ]);
  const start = new Date(2026, 8, 15, 23).getTime(),
    end = start + 7200000;
  const original = {
    id: "s",
    academicYearId: "y",
    academicYearName: "Year",
    subjectId: "s",
    subjectName: "Subject",
    startTime: start,
    endTime: end,
    focusedDurationSeconds: 3600,
    durationMode: "unlocked" as const,
    archived: true,
    focusIntervals: [{ startTime: start, endTime: start + 3600000 }],
  };
  await databaseUnderTest.sessions.add(original);
  const input = { ...original, focusedAfterMidnightSeconds: 0, note: "new" };
  for (const change of [{ note: "changed" }, { subjectId: "s2" }, { academicYearId: "other", subjectId: "s3" }]) {
    await databaseUnderTest.sessions.put(original);
    expect(await saveSessionEdit("s", { ...input, ...change }, {}, databaseUnderTest)).toBe("saved");
    expect((await databaseUnderTest.sessions.get("s"))?.focusIntervals).toEqual(original.focusIntervals);
  }
  for (const change of [{ startTime: start - 1000 }, { endTime: end + 1000 }, { focusedDurationSeconds: 3500 }]) {
    await databaseUnderTest.sessions.put(original);
    expect(await saveSessionEdit("s", { ...input, ...change }, {}, databaseUnderTest)).toBe("timing");
    expect(await databaseUnderTest.sessions.get("s")).toEqual(original); // Cancel means no save call.
    expect(await saveSessionEdit("s", { ...input, ...change }, { timing: true }, databaseUnderTest)).toBe("saved");
    expect((await databaseUnderTest.sessions.get("s"))?.focusIntervals).toBeUndefined();
    expect(await saveSessionEdit("s", { ...input, ...change }, {}, databaseUnderTest)).toBe("saved");
  }
  await databaseUnderTest.sessions.put(original);
  expect(await saveSessionEdit("s", input, {}, databaseUnderTest)).toBe("saved"); // Restored timing, no warning.
  await databaseUnderTest.sessions.add({
    ...original,
    id: "already-invalid",
    startTime: new Date(2026, 7, 30).getTime(),
  });
  const narrow = { ...year, endDate: "2026-09-14" };
  expect(await saveAcademicYearEdit(narrow, false, databaseUnderTest)).toBe(1);
  expect(await databaseUnderTest.academicYears.get("y")).toEqual(year);
  expect((await databaseUnderTest.sessions.get("s"))?.archived).toBe(true);
  expect(await saveAcademicYearEdit(narrow, true, databaseUnderTest)).toBe(0);
  expect(await saveAcademicYearEdit(year, false, databaseUnderTest)).toBe(0);
});
