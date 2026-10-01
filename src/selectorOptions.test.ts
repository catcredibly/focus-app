import { expect, it } from "vitest";
import { academicYearOptions, subjectOptions, selectableSubjects, pruneSubjectSelection } from "./selectorOptions";
import { inHistoryScope } from "./historyFilters";
import { filterSessions } from "./analytics/analytics";
import { analyticsScopes } from "./analytics/scopes";
import { dailyActivityScope } from "./analytics/dailyActivity";
import { defaultSessionSubject, timerSetupStep } from "./subjectDefaults";
import { initialTimerState, startTimerState, startStopwatchState, completedSession } from "./timerState";
import type { FocusSession } from "./types";

const years = [
  { id: "old-z", name: "Z Old", archived: true },
  { id: "uni", name: "University", archived: false, startDate: "2100-01-01" },
  { id: "old-a", name: "A Old", archived: true },
  { id: "self", name: "Self Study", archived: false, endDate: "2000-01-01" },
  { id: "empty", name: "Empty", archived: false },
];
const subject = (id: string, academicYearId: string, name: string, archived = false) => ({
  id,
  academicYearId,
  name,
  archived,
  color: "#fff",
});
const subjects = [
  subject("uni-physics", "uni", "Physics"),
  subject("self-programming", "self", "Programming"),
  subject("old-z-physics", "old-z", "Physics"),
  subject("self-japanese", "self", "Japanese"),
  subject("uni-chemistry", "uni", "Chemistry"),
  subject("old-a-math", "old-a", "Mathematics"),
  subject("archived", "uni", "Archived", true),
  subject("orphan", "missing", "Orphan"),
];

it("orders both archive sections alphabetically and keeps the input untouched", () => {
  expect(academicYearOptions(years).map((option) => option.value)).toEqual(["empty", "self", "uni", "old-a", "old-z"]);
  expect(years[0].id).toBe("old-z");
});

it("offers past and future non-archived years on the Timer, excluding archived and orphan Subjects", () => {
  const options = subjectOptions(years, subjects, [], true);
  expect(options.map((option) => [option.group, option.label])).toEqual([
    ["Self Study", "Japanese"],
    ["Self Study", "Programming"],
    ["University", "Chemistry"],
    ["University", "Physics"],
  ]);
  expect(selectableSubjects(years, subjects)).toHaveLength(4);
  expect(timerSetupStep(years, subjects)).toBeNull();
  expect(
    defaultSessionSubject(subjects, years, {
      subjectPickerMode: "fixed",
      defaultSubjectId: "uni-physics",
      lastSubjectId: "self-japanese",
    }),
  ).toBe("uni-physics");
  expect(
    defaultSessionSubject(subjects, years, {
      subjectPickerMode: "remember",
      defaultSubjectId: "uni-physics",
      lastSubjectId: "self-japanese",
    }),
  ).toBe("self-japanese");
});

it("omits a Timer header when only one year contains eligible Subjects", () => {
  expect(
    subjectOptions(
      years,
      subjects.filter((subject) => subject.academicYearId !== "self"),
      [],
      true,
    ).map((option) => [option.group, option.label]),
  ).toEqual([
    [undefined, "Chemistry"],
    [undefined, "Physics"],
  ]);
});

it("groups All-year historical choices and keeps duplicate names and archived history distinct", () => {
  const options = subjectOptions(years, subjects);
  expect(options.map((option) => option.value)).toEqual([
    "self-japanese",
    "self-programming",
    "archived",
    "uni-chemistry",
    "uni-physics",
    "old-a-math",
    "old-z-physics",
  ]);
  expect(
    options
      .filter((option) => option.label === "Physics")
      .map((option) => [option.value, option.group, option.archived]),
  ).toEqual([
    ["uni-physics", "University", false],
    ["old-z-physics", "Z Old", true],
  ]);
  expect(subjectOptions(years, subjects, ["uni"]).every((option) => option.group === undefined)).toBe(true);
  expect(subjectOptions(years, subjects, ["uni", "old-z"]).map((option) => option.value)).toEqual([
    "archived",
    "uni-chemistry",
    "uni-physics",
    "old-z-physics",
  ]);
  expect(subjectOptions(years, subjects, ["empty"])).toEqual([]);
});

it("preserves compatible Subject selections when switching to All or adding years", () => {
  const selected = ["uni-physics", "old-z-physics"];
  expect(pruneSubjectSelection(selected, subjects, [])).toEqual(selected);
  expect(pruneSubjectSelection(selected, subjects, ["uni"])).toEqual(["uni-physics"]);
  expect(pruneSubjectSelection(["uni-physics"], subjects, ["uni", "self"])).toEqual(["uni-physics"]);
});

it("combines OR within each filter and AND between filters in History, Analytics, and daily activity", () => {
  const rows = [
    { id: "1", academicYearId: "self", subjectId: "self-japanese", focusedDurationSeconds: 60, startTime: 1000 },
    { id: "2", academicYearId: "uni", subjectId: "uni-physics", focusedDurationSeconds: 60, startTime: 2000 },
    { id: "3", academicYearId: "old-z", subjectId: "old-z-physics", focusedDurationSeconds: 60, startTime: 3000 },
    { id: "4", academicYearId: "uni", subjectId: "uni-chemistry", focusedDurationSeconds: 60, startTime: 4000 },
  ] as FocusSession[];
  const yearIds = ["uni", "old-z"],
    subjectIds = ["uni-physics", "old-z-physics", "self-japanese"];
  const result = rows.filter((row) => inHistoryScope(row, { yearIds, subjectIds }));
  expect(result.map((row) => row.id)).toEqual(["2", "3"]);
  expect(filterSessions(rows, { academicYearIds: yearIds, subjectIds })).toEqual(result);
  expect(dailyActivityScope(rows, years, subjects, yearIds, subjectIds).sessions).toEqual(result);
  expect(rows.filter((row) => inHistoryScope(row, { yearIds: [], subjectIds }))).toHaveLength(3);
  expect(filterSessions(rows, { academicYearIds: [], subjectIds: [] })).toEqual(rows);
  const scope = analyticsScopes(rows, { academicYearIds: yearIds, subjectIds }, "All", Date.now());
  expect(scope.history).toEqual(result);
  expect(scope.goalHistory).toEqual(rows);
});

it("starts timers in the chosen Subject's parent year and rejects archived or mismatched relationships", () => {
  const state = { ...initialTimerState };
  for (const id of ["self-japanese", "uni-physics"]) {
    const chosen = subjects.find((subject) => subject.id === id)!;
    const year = years.find((year) => year.id === chosen.academicYearId)!;
    const timer = startTimerState(state, 60, chosen, year, 1000, id);
    expect(timer).toMatchObject({ running: true, subjectId: id, academicYearId: year.id });
    expect(
      completedSession(
        { ...timer, finished: true, finishedAt: 61000, accumulatedFocusedSeconds: 60, runningSince: null },
        61000,
      ),
    ).toMatchObject({ subjectId: id, academicYearId: year.id });
  }
  const chosen = subjects[0],
    year = years[1];
  expect(startTimerState(state, 60, chosen, { ...year, archived: true })).toBe(state);
  expect(startTimerState(state, 60, { ...chosen, archived: true }, year)).toBe(state);
  expect(startTimerState(state, 60, chosen, years[3])).toBe(state);
  expect(startStopwatchState(state, chosen, { ...year, archived: true })).toBe(state);
});
