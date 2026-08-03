import type { AttendanceImportFormat, AttendanceImportRow, AttendanceReportType } from "./types";

export type AttendancePreviewValidationStatus =
  | "valid"
  | "warning"
  | "error"
  | "duplicate"
  | "unknown_employee";

export type AttendanceImportIssue = {
  code: string;
  message: string;
  rowIndex?: number;
  employeeCode?: string;
};

export type AttendancePreviewRow = {
  rowIndex: number;
  employeeCode: string;
  employeeName: string;
  attendanceDate: string | null;
  shift: string;
  inTime: string;
  outTime: string;
  status: string;
  workDuration: string;
  validationStatus: AttendancePreviewValidationStatus;
  messages: string[];
  /** True when this row is eligible to pass to the importer. */
  importable: boolean;
};

export type AttendanceImportPreviewSummary = {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  unknownEmployees: number;
  warnings: number;
  errors: number;
  importableRows: number;
  employeesDetected: number;
  datesDetected: number;
};

export type AttendanceImportPreviewMeta = {
  fileName: string;
  fileSize: number;
  format: AttendanceImportFormat;
  reportType: AttendanceReportType;
  formAttendanceDate: string | null;
  datesFromFile: boolean;
};

export type AttendanceImportPreview = {
  previewId: string;
  meta: AttendanceImportPreviewMeta;
  reportType: AttendanceReportType;
  rows: AttendancePreviewRow[];
  summary: AttendanceImportPreviewSummary;
  warnings: AttendanceImportIssue[];
  errors: AttendanceImportIssue[];
  /** Blocking errors prevent Confirm Import. */
  canConfirm: boolean;
};

/** Server-only cached payload (rows ready for importAttendanceRows). */
export type AttendancePreviewCacheEntry = {
  previewId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  fileName: string;
  fileSize: number;
  format: AttendanceImportFormat;
  reportType: AttendanceReportType;
  formAttendanceDate: Date;
  /** Parsed rows (single parse); confirm reuses these. */
  rows: AttendanceImportRow[];
  preview: AttendanceImportPreview;
};
