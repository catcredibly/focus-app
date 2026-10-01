import type { AcademicYear, Subject } from "./types";
import type { FocusSettings } from "./settings";
import { selectableSubjects, orderedAcademicYears, alphabetical } from "./selectorOptions";

export function defaultSessionSubject(
  subjects: Subject[],
  years: AcademicYear[],
  settings: Pick<FocusSettings, "subjectPickerMode" | "defaultSubjectId" | "lastSubjectId">,
) {
  const available = selectableSubjects(years, subjects);
  const eligible = orderedAcademicYears(years).flatMap((year) =>
    alphabetical(available.filter((subject) => subject.academicYearId === year.id)),
  );
  const preferred = settings.subjectPickerMode === "fixed" ? settings.defaultSubjectId : settings.lastSubjectId;
  return (
    eligible.find((subject) => subject.id === preferred)?.id ??
    (settings.subjectPickerMode === "remember" ? (eligible[0]?.id ?? "") : "")
  );
}

/** No permanent onboarding flag: requirements follow all eligible entities. */
export function timerSetupStep(years: AcademicYear[], subjects: Subject[]): 1 | 2 | null {
  if (!years.some((year) => !year.archived)) return 1;
  return selectableSubjects(years, subjects).length ? null : 2;
}
