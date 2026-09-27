import { expect, it } from "vitest";
import { enteredHistoryPage, historyPagination } from "./historyPagination";
it("preserves valid page numbers and clamps after page size or result-count changes", () => {
  expect(historyPagination(412, 25, 1)).toEqual({ page: 1, pages: 17, start: 26, end: 50 });
  expect(historyPagination(51, 50, 4)).toEqual({ page: 1, pages: 2, start: 51, end: 51 });
  expect(historyPagination(0, 25, 8)).toEqual({ page: 0, pages: 1, start: 0, end: 0 });
  expect(enteredHistoryPage("", 2, 4)).toBe(2);
  expect(enteredHistoryPage("2.5", 2, 4)).toBe(2);
  expect(enteredHistoryPage("-2", 2, 4)).toBe(0);
  expect(enteredHistoryPage("99", 2, 4)).toBe(3);
});
