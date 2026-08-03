/**
 * Normalized attendance row shared by Excel and PDF parsers.
 * Parsers must emit this shape; only the shared importer writes to the DB.
 *
 * Phase 2: optional per-row `attendanceDate` (Summary-ready). Excel / Daily PDF
 * omit it so the importer falls back to the upload-form date.
 */
export type AttendanceImportRow = {
  employeeCode: string;
  employeeName: string;
  shift: string;
  /** Raw in-time cell (Excel serial, Date, or string). */
  inTime: unknown;
  /** Raw out-time cell (Excel serial, Date, or string). */
  outTime: unknown;
  workDuration: string;
  /** Overtime cell (legacy field name `ot` — unchanged for Excel/Daily compatibility). */
  ot: string | number | null | undefined;
  status: string;
  remarks: string;
  /**
   * Calendar day for this row when the parser knows it (future Summary PDF).
   * Excel Daily and PDF Daily leave this undefined.
   */
  attendanceDate?: Date;
  /** Report origin for diagnostics / audit (in-memory only; not a DB column). */
  source: AttendanceReportType;
};

/** Row fields before `source` is stamped by normalize / dispatch. */
export type AttendanceImportRowDraft = Omit<AttendanceImportRow, "source">;

export type AttendanceImportParseResult =
  | { ok: true; rows: AttendanceImportRow[] }
  | { ok: false; error: string };

export type AttendanceImportFormat = "excel" | "pdf";

/**
 * Detected attendance report layout (Phase 1 foundation).
 * Detection runs before format-specific parsers; UNKNOWN means we cannot classify.
 */
export type AttendanceReportType =
  | "EXCEL_DAILY"
  | "PDF_DAILY"
  | "PDF_SUMMARY"
  | "UNKNOWN";

/** @deprecated Phase 4 implements Summary parsing — kept for older test references. */
export const SUMMARY_PDF_NOT_SUPPORTED_ERROR =
  "Summary PDF reports are not supported yet." as const;

/**
 * Resolve the attendance date for a single import row.
 * Sole fallback site: row date when present, otherwise upload-form date.
 */
export function resolveImportAttendanceDate(
  row: Pick<AttendanceImportRow, "attendanceDate">,
  formAttendanceDate: Date
): Date {
  return row.attendanceDate ?? formAttendanceDate;
}

/** True when every row carries a usable per-row attendance date from the file. */
export function rowsProvideAttendanceDates(
  rows: readonly Pick<AttendanceImportRow, "attendanceDate">[]
): boolean {
  if (rows.length === 0) return false;
  return rows.every(
    (r) =>
      r.attendanceDate instanceof Date && !Number.isNaN(r.attendanceDate.getTime())
  );
}
