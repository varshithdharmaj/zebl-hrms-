import type { AttendanceReportType } from "./types";

export type AttendanceReportMetadata = {
  reportType: AttendanceReportType;
  /** True when the upload form must collect an attendance date. */
  requiresAttendanceDate: boolean;
  /** True when dates come from the file (Summary PDF). */
  datesFromFile: boolean;
  /** Short UI label for the detected report. */
  label: string;
};

/**
 * Maps a detected report type to upload UX metadata.
 * Pure — safe for client and tests.
 */
export function buildAttendanceReportMetadata(
  reportType: AttendanceReportType
): AttendanceReportMetadata {
  switch (reportType) {
    case "EXCEL_DAILY":
      return {
        reportType,
        requiresAttendanceDate: true,
        datesFromFile: false,
        label: "Excel Daily detected",
      };
    case "PDF_DAILY":
      return {
        reportType,
        requiresAttendanceDate: true,
        datesFromFile: false,
        label: "Daily Attendance PDF detected",
      };
    case "PDF_SUMMARY":
      return {
        reportType,
        requiresAttendanceDate: false,
        datesFromFile: true,
        label: "Summary Attendance PDF detected",
      };
    case "UNKNOWN":
    default:
      return {
        reportType: "UNKNOWN",
        requiresAttendanceDate: true,
        datesFromFile: false,
        label: "Report type could not be determined",
      };
  }
}

/** UI mode for the attendance-date region after file selection. */
export type AttendanceDateFieldMode =
  | "hidden"
  | "detecting"
  | "date"
  | "summary"
  | "unknown";

export function resolveAttendanceDateFieldMode(input: {
  hasFile: boolean;
  status: "idle" | "detecting" | "ready" | "error";
  metadata: AttendanceReportMetadata | null;
}): AttendanceDateFieldMode {
  if (!input.hasFile || input.status === "idle") return "hidden";
  if (input.status === "detecting") return "detecting";
  if (input.metadata?.datesFromFile) return "summary";
  if (input.status === "error" || input.metadata?.reportType === "UNKNOWN") {
    return "unknown";
  }
  return "date";
}
