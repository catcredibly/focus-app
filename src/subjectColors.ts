import { db, type FocusDatabase } from "./db";
import type { Subject } from "./types";

export const SUBJECT_COLORS = [
  "#4da3ff", // Blue
  "#ff4d57", // Red
  "#ffad3b", // Orange
  "#4dd39a", // Green
  "#a879ff", // Purple
  "#ff7eb6", // Pink
  "#45d9e8", // Cyan
  "#a8d94f", // Lime
  "#f4d64e", // Yellow
  "#6672e5", // Indigo
  "#2cb7a9", // Teal
  "#d95fe8", // Magenta
];

export function nextSubjectColor(subjects: Subject[], academicYearId: string): string {
  const counts = SUBJECT_COLORS.map(
    (color) =>
      subjects.filter(
        (subject) =>
          !subject.archived && subject.academicYearId === academicYearId && subject.color.toLowerCase() === color,
      ).length,
  );
  return SUBJECT_COLORS[counts.indexOf(Math.min(...counts))];
}

/** Cycle only on explicit clicks; read within the transaction to preserve rapid clicks. */
export async function cycleSubjectColor(id: string, database: FocusDatabase = db) {
  await database.transaction("rw", database.subjects, async () => {
    const subject = await database.subjects.get(id);
    if (!subject) return;
    const index = SUBJECT_COLORS.indexOf(subject.color.toLowerCase());
    await database.subjects.update(id, { color: SUBJECT_COLORS[(index + 1) % SUBJECT_COLORS.length] });
  });
}
