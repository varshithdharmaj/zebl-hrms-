import "server-only";

import { toISODate } from "@/lib/utils";
import { detectAttendanceReportType } from "./detect-report-type";
import { extractAttendancePdf } from "./extract-pdf";
import { validateAttendanceUploadFile } from "./file-validation";
import { extractEsslDailyAttendanceDate } from "./parse-pdf-daily-essl";
import {
  buildAttendanceReportMetadata,
  type AttendanceReportMetadata,
} from "./report-metadata";

export type { AttendanceReportMetadata } from "./report-metadata";
export {
  buildAttendanceReportMetadata,
  resolveAttendanceDateFieldMode,
} from "./report-metadata";

export type AttendanceReportMetadataResult =
  | { ok: true; metadata: AttendanceReportMetadata }
  | { ok: false; error: string };

/**
 * Lightweight report-type probe for upload UX.
 * Reuses validateAttendanceUploadFile + detectAttendanceReportType.
 * Excel: no workbook parse (format alone → EXCEL_DAILY).
 * PDF: extract text once via extractAttendancePdf, then detect — does NOT run
 * Daily/Summary row parsers (import still parses once on submit).
 * For Daily PDFs, also probes "Attendance Date" for form UX.
 */
export async function getAttendanceReportMetadata(input: {
  fileName: string;
  mimeType: string;
  size: number;
  bytes: Uint8Array;
}): Promise<AttendanceReportMetadataResult> {
  const validation = validateAttendanceUploadFile({
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.size,
    bytes: input.bytes,
  });

  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  if (validation.format === "excel") {
    const detection = detectAttendanceReportType({
      format: "excel",
      fileName: input.fileName,
    });
    return { ok: true, metadata: buildAttendanceReportMetadata(detection.type) };
  }

  try {
    const { mergedText } = await extractAttendancePdf(input.bytes);
    if (!mergedText.trim()) {
      return { ok: true, metadata: buildAttendanceReportMetadata("UNKNOWN") };
    }
    const detection = detectAttendanceReportType({
      format: "pdf",
      fileName: input.fileName,
      extractedText: mergedText,
    });

    if (detection.type === "PDF_DAILY") {
      const extracted = extractEsslDailyAttendanceDate(mergedText);
      return {
        ok: true,
        metadata: buildAttendanceReportMetadata("PDF_DAILY", {
          detectedAttendanceDate: extracted ? toISODate(extracted) : null,
        }),
      };
    }

    return { ok: true, metadata: buildAttendanceReportMetadata(detection.type) };
  } catch {
    return { ok: true, metadata: buildAttendanceReportMetadata("UNKNOWN") };
  }
}
