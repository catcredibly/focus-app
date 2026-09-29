import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FocusDatabase } from "./db";
import { saveFocusSession } from "./saveFocusSession";
import type { FocusSession } from "./types";

let database: FocusDatabase;
beforeEach(() => {
  database = new FocusDatabase("goal-completion-test");
});
const now = new Date(2026, 8, 24, 12).getTime();
const session = (id: string, seconds = 60): FocusSession => ({
  id,
  subjectId: "s",
  subjectName: "S",
  academicYearId: "y",
  academicYearName: "Y",
  startTime: now - seconds * 1000,
  endTime: now,
  focusedDurationSeconds: seconds,
  archived: false,
});
async function goals() {
  await database.settings.bulkPut(
    ["daily", "weekly"].flatMap((kind) => [
      { key: `${kind}GoalEnabled`, value: "true" },
      { key: `${kind}GoalSeconds`, value: "100" },
    ]),
  );
}
afterEach(() => database.delete());
it("retains exact retry data after a failed save and stores only the final day split", async () => {
  const start = new Date(2026, 8, 24, 23).getTime();
  const source = {
    ...session("retry"),
    startTime: start,
    endTime: start + 10800000,
    focusedDurationSeconds: 7200,
    focusIntervals: [
      { startTime: start, endTime: start + 1800000 },
      { startTime: start + 5400000, endTime: start + 10800000 },
    ],
  };
  const original = structuredClone(source);
  const add = vi.spyOn(database.sessions, "add").mockRejectedValueOnce(new Error("Storage unavailable"));
  await expect(saveFocusSession(source, false, database)).rejects.toThrow("Storage unavailable");
  expect(source).toEqual(original);
  expect(await database.sessions.count()).toBe(0);
  add.mockRestore();
  await saveFocusSession(source, false, database);
  const saved = await database.sessions.get(source.id);
  expect(saved?.focusIntervals).toBeUndefined();
  expect(saved?.focusedAfterMidnightSeconds).toBe(5400);
  expect(saved?.focusedDurationSeconds).toBe(7200);
  expect(source).toEqual(original);
});
describe("live goal completion", () => {
  it("queues daily before weekly and claims each period only once across webviews", async () => {
    await goals();
    expect(await saveFocusSession(session("first"), true, database, now)).toEqual([]);
    const results = await Promise.all([
      saveFocusSession(session("second"), true, database, now),
      saveFocusSession(session("second"), true, database, now),
    ]);
    expect(results.flat().map((value) => value.kind)).toEqual(["daily", "weekly"]);
    await database.sessions.clear();
    expect(await saveFocusSession(session("third", 120), true, database, now)).toEqual([]);
  });
  it("does not celebrate recovered history or lowering a target", async () => {
    await goals();
    expect(await saveFocusSession(session("recovery", 120), false, database, now)).toEqual([]);
    expect(await saveFocusSession(session("live"), true, database, now)).toEqual([]);
  });
  it("allows the next local day's crossing without repeating that week's goal", async () => {
    await goals();
    await saveFocusSession(session("first", 120), true, database, now);
    const tomorrow = new Date(2026, 8, 25, 12).getTime();
    const next = { ...session("next", 120), startTime: tomorrow - 120000, endTime: tomorrow };
    expect((await saveFocusSession(next, true, database, tomorrow)).map((value) => value.kind)).toEqual(["daily"]);
  });
});
