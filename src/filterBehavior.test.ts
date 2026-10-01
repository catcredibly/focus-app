import { expect, it } from "vitest";
import { inHistoryScope, matchesHistoryStatus, historyStatusAfterScope } from "./historyFilters";
import { availableGoalMode, compatibleGoalGrouping, DEFAULT_WEEKDAY_METRIC } from "./analytics/controls";
import { noteSearchTerms, readableNote } from "./notes";
it("combines invalid status, year, subject and case-sensitive readable-note search", () => {
  const rows = [
    { academicYearId: "y", subjectId: "s", invalid: true, archived: false, note: "Algebra Review" },
    { academicYearId: "y", subjectId: "s", invalid: true, archived: true, note: "algebra review" },
    { academicYearId: "y2", subjectId: "s2", invalid: true, archived: false, note: "Algebra Review" },
    { academicYearId: "y", subjectId: "s", invalid: false, archived: false, note: "Algebra Review" },
  ];
  const scope = { yearId: "y", subjectId: "s" };
  expect(rows.filter((row) => inHistoryScope(row, scope) && row.invalid)).toHaveLength(2);
  const filtered = (matchCase: boolean) =>
    rows.filter(
      (row) =>
        inHistoryScope(row, scope) &&
        matchesHistoryStatus("invalid", row.invalid, row.archived) &&
        noteSearchTerms("Review Algebra", matchCase).every((term) =>
          (matchCase ? readableNote(row.note) : readableNote(row.note).toLocaleLowerCase()).includes(term),
        ),
    );
  expect(filtered(false)).toHaveLength(2);
  expect(filtered(true)).toHaveLength(1);
  expect(historyStatusAfterScope("invalid", 0)).toBe("all");
  expect(historyStatusAfterScope("invalid", 2)).toBe("invalid");
  expect(matchesHistoryStatus("active", true, false)).toBe(false);
  expect(matchesHistoryStatus("archived", true, true)).toBe(false);
  expect(matchesHistoryStatus("all", true, true)).toBe(true);
});
it("uses available goal modes and retains compatible temporary grouping", () => {
  expect(availableGoalMode(true, true, "daily")).toBe("daily");
  expect(availableGoalMode(true, false, "weekly")).toBe("daily");
  expect(availableGoalMode(false, true, "daily")).toBe("weekly");
  expect(availableGoalMode(false, false, "weekly")).toBe("daily");
  let grouping = compatibleGoalGrouping("weekly", "daily");
  expect(grouping).toBe("weekly");
  expect(compatibleGoalGrouping("daily", grouping)).toBe("weekly");
  expect(compatibleGoalGrouping("weekly", "monthly")).toBe("monthly");
  expect(DEFAULT_WEEKDAY_METRIC).toBe("seconds");
});
