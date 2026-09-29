export type AcademicYear = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  archived: boolean;
};

export type Subject = {
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
  focusedAfterMidnightSeconds?: number;
  /** Legacy/import compatibility only. New completed Sessions store summarized focus values. */
  focusIntervals?: { startTime: number; endTime: number }[];
};

export type AppSetting = { key: string; value: string };
