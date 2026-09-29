import "fake-indexeddb/auto";
import { createSession } from "./data";
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
});
it("relocates timer timing without losing intervals and warns only on year boundaries", async () => {
  const testDb = database();
  const year = { id: "y", name: "Y", archived: false, startDate: "2026-09-01", endDate: "2026-09-30" };
  await testDb.academicYears.add(year);
  await testDb.subjects.add({ id: "s", name: "S", academicYearId: "y", color: "#fff", archived: false });
  const start = new Date(2026, 8, 15, 23).getTime();
  const original = {
    id: "s",
    subjectId: "s",
    subjectName: "S",
    academicYearId: "y",
    academicYearName: "Y",
    archived: false,
    startTime: start,
    endTime: start + 7200000,
    focusedDurationSeconds: 3600,
    focusIntervals: [{ startTime: start, endTime: start + 3600000 }],
  };
  await testDb.sessions.add(original);
  const moved = {
    academicYearId: "y",
    subjectId: "s",
    startTime: new Date(2026, 7, 30, 23).getTime(),
    endTime: 1,
    note: "moved",
  };
  expect(await saveSessionEdit("s", moved, {}, testDb)).toBe("invalid");
  expect(await testDb.sessions.get("s")).toEqual(original);
  expect(await saveSessionEdit("s", moved, { invalid: true }, testDb)).toBe("saved");
  expect(await testDb.sessions.get("s")).toMatchObject({
    endTime: moved.startTime + 7200000,
    focusedDurationSeconds: 3600,
    focusIntervals: [{ startTime: moved.startTime, endTime: moved.startTime + 3600000 }],
  });
  await saveSessionEdit("s", { ...moved, startTime: start }, {}, testDb);
  expect(await saveAcademicYearEdit({ ...year, endDate: "2026-09-14" }, false, testDb)).toBe(1);
  expect(await testDb.academicYears.get("y")).toEqual(year);
});
it("derives manual duration across multiple dates without a focus-time limit", async () => {
  const testDb = database();
  await testDb.academicYears.add({ id: "y", name: "Y", archived: false });
  await testDb.subjects.add({ id: "s", name: "S", academicYearId: "y", color: "#fff", archived: false });
  await testDb.sessions.add({
    id: "s",
    subjectId: "s",
    subjectName: "S",
    academicYearId: "y",
    academicYearName: "Y",
    archived: false,
    manual: true,
    startTime: 1000,
    endTime: 2000,
    focusedDurationSeconds: 1,
  });
  await updateSessionDetails(
    "s",
    { academicYearId: "y", subjectId: "s", startTime: 1000, endTime: 1000 + 7 * 86400000 },
    testDb,
  );
  expect((await testDb.sessions.get("s"))?.focusedDurationSeconds).toBe(7 * 86400);
});

it("Add Session explicitly stores manual true and derives continuous focus", async () => {
  const testDb = database();
  const subject = { id: "s", name: "S", academicYearId: "y", color: "#fff", archived: false };
  const academicYear = { id: "y", name: "Y", archived: false };
  const session = await createSession({ subject, academicYear, startTime: 1000, endTime: 1000 + 4 * 86400000 }, testDb);
  expect(session.manual).toBe(true);
  expect(session.focusedDurationSeconds).toBe(4 * 86400);
  expect((await testDb.sessions.get(session.id))?.manual).toBe(true);
});
