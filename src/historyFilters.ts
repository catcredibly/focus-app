import { matchesSelection } from "./selectorOptions";
export type HistoryScope = { yearId?: string; subjectId?: string; yearIds?: string[]; subjectIds?: string[] };
export function inHistoryScope(session: { academicYearId: string; subjectId: string }, scope: HistoryScope) {
  return (
    (!scope.yearId || session.academicYearId === scope.yearId) &&
    (!scope.subjectId || session.subjectId === scope.subjectId) &&
    matchesSelection(session.academicYearId, scope.yearIds ?? []) &&
    matchesSelection(session.subjectId, scope.subjectIds ?? [])
  );
}
export function historyStatusAfterScope(status: string, invalidCount: number) {
  return status === "invalid" && !invalidCount ? "all" : status;
}
export function matchesHistoryStatus(status: string, invalid: boolean, archived: boolean) {
  return status === "all" || (status === "invalid" ? invalid : !invalid && archived === (status === "archived"));
}
