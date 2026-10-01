export type AcademicYear = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  archived: boolean;
};

export type Subject = {
  /** Independent archive intent saved while the parent forces archival. */
  archivedBeforeParent?: boolean;
  id: string;
  academicYearId: string;
  name: string;
  color: string;
  archived: boolean;
};

export type FocusSession = {
  id: string;
  subjectId: string;
  startTime: number;
  endTime: number;
  focusedDurationSeconds: number;
  durationMode?: "locked" | "unlocked";
  subjectName: string;
  academicYearId: string;
  academicYearName: string;
  note?: string;
  archived: boolean;
  manual?: true;
  /** Set only by the legacy data migration; never inferred during ordinary reads. */
  legacyContinuous?: true;
  focusIntervals?: { startTime: number; endTime: number }[];
};

export type AppSetting = { key: string; value: string };
