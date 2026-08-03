import "server-only";

import { detectAttendanceReportType } from "./detect-report-type";
import { extractAttendancePdf } from "./extract-pdf";
import {
  looksLikeEsslDailyBasicPdf,
  parseEsslDailyBasicPdf,
} from "./parse-pdf-daily-essl";
import { parseAttendancePdfSummary } from "./parse-pdf-summary";
import { parseAttendancePdfText, PDF_IMPORT_ERRORS } from "./parse-pdf-text";
import type {
  AttendanceImportParseResult,
  AttendanceReportType,
} from "./types";

export type ParseAttendancePdfOptions = {
  fileName?: string;
};

export type ParseAttendancePdfResult = AttendanceImportParseResult & {
  reportType?: AttendanceReportType;
};

/**
 * Server-only PDF → normalized attendance rows.
 *
 * - PDF_SUMMARY → eSSL Summary state machine on PdfDocument
 * - PDF_DAILY → eSSL Daily Basic (geometry) when recognized, else delimited-text Daily parser
 */
export async function parseAttendancePdf(
  bytes: Uint8Array,
  options: ParseAttendancePdfOptions = {}
): Promise<ParseAttendancePdfResult> {
  try {
    const { document, mergedText } = await extractAttendancePdf(bytes);

    if (!document.totalPages || document.totalPages < 1) {
      return {
        ok: false,
        error:
          "The PDF appears to be empty. Supported PDFs are structured attendance reports with recognizable tabular columns. For unsupported or complex reports, export as Excel and upload the Excel file instead.",
        reportType: "UNKNOWN",
      };
    }

    if (!mergedText.trim()) {
      return {
        ok: false,
        error: PDF_IMPORT_ERRORS.NO_TEXT,
        reportType: "UNKNOWN",
      };
    }

    const detection = detectAttendanceReportType({
      format: "pdf",
      fileName: options.fileName,
      extractedText: mergedText,
    });

    if (detection.type === "PDF_SUMMARY") {
      const parsed = parseAttendancePdfSummary(document);
      return { ...parsed, reportType: "PDF_SUMMARY" };
    }

    // eSSL Daily Attendance (Basic Report): column geometry — not pipe/tab/multi-space text
    if (looksLikeEsslDailyBasicPdf(document, mergedText)) {
      const essl = parseEsslDailyBasicPdf(document);
      if (essl.ok) {
        return { ...essl, reportType: "PDF_DAILY" };
      }
      // Fall through to delimited parser only when geometry path found no usable header
    }

    const reportType: AttendanceReportType =
      detection.type === "UNKNOWN" ? "UNKNOWN" : "PDF_DAILY";
    const parsed = parseAttendancePdfText(mergedText);
    return { ...parsed, reportType };
  } catch (error) {
    console.error("PDF parse error:", error);
    return {
      ok: false,
      error:
        "Failed to process PDF file. The file may be corrupted, password-protected, or not a valid structured attendance PDF. For unsupported or complex reports, export as Excel and upload the Excel file instead.",
      reportType: "UNKNOWN",
    };
  }
}
