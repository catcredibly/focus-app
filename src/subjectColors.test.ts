import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { FocusDatabase } from "./db";
import { cycleSubjectColor, SUBJECT_COLORS } from "./subjectColors";

let database: FocusDatabase;
beforeEach(async () => {
  database = new FocusDatabase(`subject-colors-${crypto.randomUUID()}`);
  await database.subjects.add({
    id: "subject",
    name: "Math",
    academicYearId: "year",
    archived: true,
    color: SUBJECT_COLORS[0],
  });
});
afterEach(() => database.delete());
it("persists each palette color in order, wraps, and changes only the chosen Subject color", async () => {
  const original = await database.subjects.get("subject");
  await database.subjects.add({ ...original!, id: "other" });
  for (let click = 1; click <= SUBJECT_COLORS.length; click++) {
    await cycleSubjectColor("subject", database);
    expect(await database.subjects.get("subject")).toEqual({
      ...original,
      color: SUBJECT_COLORS[click % SUBJECT_COLORS.length],
    });
    expect(await database.subjects.get("other")).toEqual({ ...original, id: "other" });
  }
});
it("preserves consecutive clicks before the list rerenders", async () => {
  await Promise.all([cycleSubjectColor("subject", database), cycleSubjectColor("subject", database)]);
  expect((await database.subjects.get("subject"))?.color).toBe(SUBJECT_COLORS[2]);
});
