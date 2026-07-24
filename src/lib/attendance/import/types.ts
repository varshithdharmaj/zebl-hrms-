/**
 * Normalized attendance row shared by Excel and PDF parsers.
 * Parsers must emit this shape; only the shared importer writes to the DB.
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
  ot: string | number | null | undefined;
  status: string;
  remarks: string;
};

export type AttendanceImportParseResult =
  | { ok: true; rows: AttendanceImportRow[] }
  | { ok: false; error: string };

export type AttendanceImportFormat = "excel" | "pdf";
