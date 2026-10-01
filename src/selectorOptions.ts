import type { AcademicYear, Subject } from "./types";
import { localeCode } from "./i18n";

export type SelectorOption = { value: string; label: string; archived?: boolean; group?: string; groupId?: string };

export function alphabetical<T extends { name: string; id: string }>(items: T[]) {
  const compare = new Intl.Collator(localeCode(), { sensitivity: "base", numeric: true });
  return [...items].sort((a, b) => compare.compare(a.name, b.name) || a.id.localeCompare(b.id));
}

export function orderedAcademicYears(years: AcademicYear[]) {
  return [
    ...alphabetical(years.filter((year) => !year.archived)),
    ...alphabetical(years.filter((year) => year.archived)),
  ];
}

export function academicYearOptions(years: AcademicYear[]): SelectorOption[] {
  return orderedAcademicYears(years).map((year) => ({ value: year.id, label: year.name, archived: year.archived }));
}

/** An empty selection means All. IDs keep identically named Subjects distinct. */
export function subjectsInYears(subjects: Subject[], yearIds: readonly string[]) {
  return subjects.filter((subject) => !yearIds.length || yearIds.includes(subject.academicYearId));
}

export function selectableSubjects(years: AcademicYear[], subjects: Subject[]) {
  const ids = new Set(years.filter((year) => !year.archived).map((year) => year.id));
  return subjects.filter((subject) => !subject.archived && ids.has(subject.academicYearId));
}

export function subjectOptions(
  years: AcademicYear[],
  subjects: Subject[],
  yearIds: readonly string[] = [],
  timer = false,
): SelectorOption[] {
  const eligible = timer ? selectableSubjects(years, subjects) : subjectsInYears(subjects, yearIds);
  const groups = orderedAcademicYears(years).filter(
    (year) =>
      (!yearIds.length || yearIds.includes(year.id)) && eligible.some((subject) => subject.academicYearId === year.id),
  );
  const grouped = timer ? groups.length > 1 : true;
  return groups.flatMap((year) =>
    alphabetical(eligible.filter((subject) => subject.academicYearId === year.id)).map((subject) => ({
      value: subject.id,
      label: subject.name,
      archived: year.archived,
      group: grouped ? year.name : undefined,
      groupId: grouped ? year.id : undefined,
    })),
  );
}

export function matchesSelection(id: string, selection: readonly string[]) {
  return !selection.length || selection.includes(id);
}

export function searchSelectorOptions(options: SelectorOption[], query: string) {
  const text = query.trim().toLocaleLowerCase(localeCode());
  return !text
    ? options
    : options.filter(
        (option) =>
          !option.value ||
          option.label.toLocaleLowerCase(localeCode()).includes(text) ||
          option.group?.toLocaleLowerCase(localeCode()).includes(text),
      );
}

export function pruneSubjectSelection(selection: string[], subjects: Subject[], yearIds: readonly string[]) {
  const available = new Set(subjectsInYears(subjects, yearIds).map((subject) => subject.id));
  return selection.filter((id) => available.has(id));
}
