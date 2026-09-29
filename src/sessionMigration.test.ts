import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";
import { FocusDatabase } from "./db";
import { sessionInvalidReason, validSessions } from "./sessionValidity";
import { goalProgress } from "./goals";
import { dailyFocusAllocations, reconstructSessionFields } from "./sessionAllocation";
import { timeOfDayMatrix, sessionsWithoutExactTimeOfDay } from "./analytics/analytics";
import { saveSessionEdit } from "./management";
const start = new Date(2026, 8, 21, 23).getTime();
const base = {
  id: "s",
  subjectId: "s",
  subjectName: "S",
  academicYearId: "y",
  academicYearName: "Y",
  archived: false,
  startTime: start,
  endTime: start + 10800000,
  focusedDurationSeconds: 3600,
};
it("migrates only exact reconstructable splits and performs no writes on ordinary reads", async () => {
  const name = `migration-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  old.version(3).stores({ academicYears: "id", subjects: "id", sessions: "id", settings: "key" });
  const exact = { ...base, focusIntervals: [{ startTime: start + 1800000, endTime: start + 5400000 }] };
  const unknown = { ...base, id: "unknown" };
  const tooLong = { ...exact, id: "long", endTime: start + 172800000 };
  await old.table("sessions").bulkAdd([exact, unknown, tooLong]);
  old.close();
  const database = new FocusDatabase(name);
  try {
    expect((await database.sessions.get("s"))?.focusedAfterMidnightSeconds).toBe(1800);
    expect(await database.sessions.get("unknown")).toEqual(unknown);
    expect(await database.sessions.get("long")).toEqual(tooLong);
    let writes = 0;
    database.sessions.hook("updating", () => {
      writes++;
    });
    const rows = await database.sessions.toArray();
    expect(rows).toHaveLength(3); // History counts stored records.
    expect(validSessions(rows, [])).toHaveLength(1);
    rows.forEach((row) => {
      sessionInvalidReason(row, undefined);
      dailyFocusAllocations(row);
    });
    await database.sessions.toArray();
    expect(writes).toBe(0);
  } finally {
    await database.delete();
  }
});
it("does not infer a legacy split from aggregate duration alone", () => {
  const continuous = { ...base, focusedDurationSeconds: 10800 };
  expect(reconstructSessionFields(continuous)).toBe(continuous);
  expect(sessionInvalidReason(continuous, undefined)).toBe("missingOvernightSplit");
});
it("corrects an invalid record through editing, retaining daily goals but excluding unknown clock timing", async () => {
  const database = new FocusDatabase(`correction-${crypto.randomUUID()}`);
  try {
    await database.academicYears.add({ id: "y", name: "Y", archived: false });
    await database.subjects.add({ id: "s", name: "S", academicYearId: "y", archived: false, color: "#fff" });
    await database.sessions.add(base);
    expect(sessionInvalidReason(base, undefined)).toBe("missingOvernightSplit");
    await saveSessionEdit("s", { ...base, focusedAfterMidnightSeconds: 1800, durationMode: "unlocked" }, {}, database);
    const saved = (await database.sessions.get("s"))!;
    expect(sessionInvalidReason(saved, undefined)).toBeUndefined();
    expect(goalProgress([saved], start + 10800000).dailySeconds).toBe(1800);
    expect(
      timeOfDayMatrix([saved])
        .flat()
        .reduce((a, b) => a + b, 0),
    ).toBe(0);
    expect(sessionsWithoutExactTimeOfDay([saved])).toHaveLength(1);
    expect(sessionsWithoutExactTimeOfDay([saved], { start: start + 86400000, end: start + 172800000 })).toHaveLength(0);
  } finally {
    await database.delete();
  }
});
