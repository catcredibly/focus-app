import { expect, it } from "vitest";
import { timerSetupStep, defaultSessionSubject } from "./subjectDefaults";
import { nextSubjectColor, SUBJECT_COLORS } from "./subjectColors";
const years = [{ id: "year", name: "Year", archived: false }];
const subjects = ["one", "two", "three"].map((id, index) => ({
  id,
  name: id,
  academicYearId: "year",
  archived: false,
  color: SUBJECT_COLORS[index],
}));
it("applies fixed precedence and limits new-session choices to Subjects across eligible years", () => {
  expect(
    defaultSessionSubject(subjects, years, {
      subjectPickerMode: "fixed",
      defaultSubjectId: "two",
      lastSubjectId: "one",
    }),
  ).toBe("two");
  expect(
    defaultSessionSubject(subjects, years, {
      subjectPickerMode: "remember",
      defaultSubjectId: "two",
      lastSubjectId: "one",
    }),
  ).toBe("one");
  expect(
    defaultSessionSubject(subjects, [], {
      subjectPickerMode: "remember",
      defaultSubjectId: "two",
      lastSubjectId: "one",
    }),
  ).toBe("");
});
it("chooses the least-used palette color within the destination year, ignoring archives", () => {
  expect(nextSubjectColor([], "year")).toBe(SUBJECT_COLORS[0]);
  expect(nextSubjectColor(subjects, "year")).toBe(SUBJECT_COLORS[3]);
  expect(
    nextSubjectColor(
      [{ ...subjects[0], archived: true }, subjects[1], { ...subjects[2], academicYearId: "other" }],
      "year",
    ),
  ).toBe(SUBJECT_COLORS[0]);
  expect(
    nextSubjectColor(
      SUBJECT_COLORS.map((color, i) => ({ ...subjects[0], id: String(i), color })),
      "year",
    ),
  ).toBe(SUBJECT_COLORS[0]);
});

it("derives setup from current active entities and reacts to removal/restoration", () => {
  const year = { id: "year", name: "Year", archived: false };
  expect(timerSetupStep([], subjects)).toBe(1);
  expect(timerSetupStep([{ ...year, archived: true }], subjects)).toBe(1);
  expect(timerSetupStep([year], [])).toBe(2);
  expect(
    timerSetupStep(
      [year],
      subjects.map((subject) => ({ ...subject, archived: true })),
    ),
  ).toBe(2);
  expect(
    timerSetupStep(
      [year],
      subjects.map((subject) => ({ ...subject, academicYearId: "other" })),
    ),
  ).toBe(2);
  expect(timerSetupStep([year], subjects)).toBeNull();
});
