import "server-only";

import { detectAttendanceReportType } from "./detect-report-type";
import { extractAttendancePdf } from "./extract-pdf";
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
 * - PDF_DAILY / UNKNOWN → merged-text Daily parser (unchanged)
 * - PDF_SUMMARY → eSSL Summary state machine on PdfDocument
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

    if (detection.type === "UNKNOWN") {
      const parsed = parseAttendancePdfText(mergedText);
      return { ...parsed, reportType: "UNKNOWN" };
    }

    const parsed = parseAttendancePdfText(mergedText);
    return { ...parsed, reportType: "PDF_DAILY" };
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
