import { detectAttendanceReportType } from "./detect-report-type";
import { parseAttendanceExcel } from "./parse-excel";
import { parseAttendancePdf } from "./parse-pdf";
import type {
  AttendanceImportFormat,
  AttendanceImportParseResult,
  AttendanceReportType,
} from "./types";

export type ParseAttendanceFileInput = {
  format: AttendanceImportFormat;
  fileName: string;
  buffer: Buffer;
  bytes: Uint8Array;
};

export type ParseAttendanceFileResult = AttendanceImportParseResult & {
  reportType?: AttendanceReportType;
};

/**
 * Architecture entry: detect report type, then dispatch to the matching parser.
 * Phase 1: Excel Daily + PDF Daily unchanged; PDF Summary returns a clear error.
 * Does not write to the database.
 */
export async function parseAttendanceFile(
  input: ParseAttendanceFileInput
): Promise<ParseAttendanceFileResult> {
  if (input.format === "excel") {
    const detection = detectAttendanceReportType({
      format: "excel",
      fileName: input.fileName,
    });
    const parsed = parseAttendanceExcel(input.buffer);
    return { ...parsed, reportType: detection.type };
  }

  // PDF: extract → detect → daily parser or summary unsupported error
  return parseAttendancePdf(input.bytes, {
    fileName: input.fileName,
  });
}
