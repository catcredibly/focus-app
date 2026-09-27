import { normalizeNote } from "./notes";
import Dexie, { type Table } from "dexie";
import type { AcademicYear, AppSetting, FocusSession, Subject } from "./types";

export class FocusDatabase extends Dexie {
  academicYears!: Table<AcademicYear, string>;
  subjects!: Table<Subject, string>;
  sessions!: Table<FocusSession, string>;
  settings!: Table<AppSetting, string>;

  constructor(name = "focus") {
    super(name);
    this.version(1).stores({
      academicYears: "id, name, startDate, endDate, archived",
      subjects: "id, academicYearId, name, archived",
      sessions: "id, subjectId, startTime, endTime, archived",
    });
    this.version(2)
      .stores({
        academicYears: "id, name, startDate, endDate, archived",
        subjects: "id, academicYearId, name, archived, [academicYearId+archived]",
        sessions: "id, subjectId, academicYearId, startTime, endTime, archived, [archived+startTime]",
        settings: "key",
      })
      .upgrade(async (tx) => {
        await tx
          .table("sessions")
          .toCollection()
          .modify((session: Partial<FocusSession>) => {
            session.focusedDurationSeconds ??= Math.max(
              0,
              Math.round(((session.endTime ?? 0) - (session.startTime ?? 0)) / 1000),
            );
            session.subjectName ??= "Unknown subject";
            session.academicYearId ??= "";
            session.academicYearName ??= "Unknown academic year";
            session.archived ??= false;
          });
      });
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("sessions")
          .toCollection()
          .modify((session: FocusSession) => {
            if (typeof session.note !== "string") return;
            const normalized = normalizeNote(session.note);
            if (normalized !== session.note) session.note = normalized;
          });
      });
  }
}

export const db = new FocusDatabase();
