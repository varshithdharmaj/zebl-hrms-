import type { AttendanceReportType } from "./types";

export type AttendanceReportMetadata = {
  reportType: AttendanceReportType;
  /** True when the upload form must collect an attendance date. */
  requiresAttendanceDate: boolean;
  /** True when dates come from the file (Summary PDF or Daily with extracted date). */
  datesFromFile: boolean;
  /** Short UI label for the detected report. */
  label: string;
  /** ISO date (yyyy-mm-dd) extracted from a Daily PDF header, when available. */
  detectedAttendanceDate?: string | null;
};

export type BuildAttendanceReportMetadataOptions = {
  /** ISO yyyy-mm-dd from Daily PDF "Attendance Date" header. */
  detectedAttendanceDate?: string | null;
};

/**
 * Maps a detected report type to upload UX metadata.
 * Pure — safe for client and tests.
 */
export function buildAttendanceReportMetadata(
  reportType: AttendanceReportType,
  options: BuildAttendanceReportMetadataOptions = {}
): AttendanceReportMetadata {
  const detected = options.detectedAttendanceDate ?? null;

  switch (reportType) {
    case "EXCEL_DAILY":
      return {
        reportType,
        requiresAttendanceDate: true,
        datesFromFile: false,
        label: "Excel Daily detected",
      };
    case "PDF_DAILY": {
      const hasDetected = Boolean(detected);
      return {
        reportType,
        requiresAttendanceDate: !hasDetected,
        datesFromFile: hasDetected,
        label: hasDetected
          ? "Daily Attendance PDF detected (date from file)"
          : "Daily Attendance PDF detected",
        detectedAttendanceDate: detected,
      };
    }
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
