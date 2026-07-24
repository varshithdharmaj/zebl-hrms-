import "server-only";

import { extractText, getDocumentProxy } from "unpdf";
import { parseAttendancePdfText, PDF_IMPORT_ERRORS } from "./parse-pdf-text";
import type { AttendanceImportParseResult } from "./types";

/** Copy into a plain ArrayBuffer-backed Uint8Array for PDF.js worker transfer. */
function toTransferablePdfBytes(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

/**
 * Server-only PDF → normalized attendance rows.
 * Uses unpdf (PDF.js serverless build) for text extraction; does not write to the DB.
 */
export async function parseAttendancePdf(
  bytes: Uint8Array
): Promise<AttendanceImportParseResult> {
  try {
    const pdf = await getDocumentProxy(toTransferablePdfBytes(bytes));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });

    if (!totalPages || totalPages < 1) {
      return {
        ok: false,
        error:
          "The PDF appears to be empty. Supported PDFs are structured attendance reports with recognizable tabular columns. For unsupported or complex reports, export as Excel and upload the Excel file instead.",
      };
    }

    const merged = typeof text === "string" ? text : "";
    if (!merged.trim()) {
      return { ok: false, error: PDF_IMPORT_ERRORS.NO_TEXT };
    }

    return parseAttendancePdfText(merged);
  } catch (error) {
    console.error("PDF parse error:", error);
    return {
      ok: false,
      error:
        "Failed to process PDF file. The file may be corrupted, password-protected, or not a valid structured attendance PDF. For unsupported or complex reports, export as Excel and upload the Excel file instead.",
    };
  }
}
