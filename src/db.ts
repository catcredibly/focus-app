import { migrateLegacySession } from "./sessionDuration";
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
    // Keep the schema number for databases already opened by the previous build.
    this.version(4).stores({});
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("sessions")
          .toCollection()
          .modify((session: FocusSession) => {
            const migrated = migrateLegacySession(session);
            if (migrated !== session) {
              session.endTime = migrated.endTime;
              session.legacyContinuous = true;
            }
          });
      });
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        const years = (await tx.table("academicYears").toArray()) as AcademicYear[];
        const archivedIds = new Set(years.filter((year) => year.archived).map((year) => year.id));
        await tx
          .table("subjects")
          .toCollection()
          .modify((subject: Subject) => {
            if (archivedIds.has(subject.academicYearId)) {
              subject.archivedBeforeParent ??= subject.archived;
              subject.archived = true;
            }
          });
      });
  }
}

export const db = new FocusDatabase();
