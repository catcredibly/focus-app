import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
