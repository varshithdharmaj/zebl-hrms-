import type { AttendanceImportFormat } from "./types";

export const ATTENDANCE_UPLOAD_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ATTENDANCE_UPLOAD_MAX_ROWS = 2000;

const EXCEL_EXTENSIONS = [".xlsx", ".xls"] as const;
const PDF_EXTENSION = ".pdf" as const;

const EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "",
]);

const PDF_MIME_TYPES = new Set([
  "application/pdf",
  "application/octet-stream",
  "",
]);

export type FileValidationResult =
  | { ok: true; format: AttendanceImportFormat }
  | { ok: false; error: string };

function hasExcelOleMagic(bytes: Uint8Array): boolean {
  // Compound File Binary Format (legacy .xls)
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  );
}

function hasZipMagic(bytes: Uint8Array): boolean {
  // ZIP / OOXML (.xlsx)
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function hasPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ); // %PDF-
}

function extensionOf(fileName: string): string {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot === -1 ? "" : lower.slice(dot);
}

/**
 * Validate upload by extension, MIME (when present), size, and magic bytes.
 * Do not trust the filename alone.
 */
export function validateAttendanceUploadFile(input: {
  fileName: string;
  mimeType: string;
  size: number;
  bytes: Uint8Array;
}): FileValidationResult {
  if (input.size === 0 || input.bytes.length === 0) {
    return { error: "Please select an Excel (.xlsx/.xls) or PDF (.pdf) file.", ok: false };
  }

  if (input.size > ATTENDANCE_UPLOAD_MAX_FILE_SIZE) {
    return { error: "File size exceeds 5MB limit.", ok: false };
  }

  const ext = extensionOf(input.fileName);
  const mime = (input.mimeType ?? "").toLowerCase().trim();

  if (ext === PDF_EXTENSION) {
    if (mime && !PDF_MIME_TYPES.has(mime)) {
      return {
        error: "Invalid PDF file type. Please upload a valid .pdf attendance report.",
        ok: false,
      };
    }
    if (!hasPdfMagic(input.bytes)) {
      return {
        error:
          "The file does not appear to be a valid PDF. Supported PDFs are structured attendance reports with recognizable tabular columns. For unsupported or complex reports, export as Excel and upload the Excel file instead.",
        ok: false,
      };
    }
    return { ok: true, format: "pdf" };
  }

  if ((EXCEL_EXTENSIONS as readonly string[]).includes(ext)) {
    if (mime && !EXCEL_MIME_TYPES.has(mime)) {
      return {
        error: "Invalid Excel file type. Please upload a valid .xlsx or .xls file.",
        ok: false,
      };
    }
    const looksExcel = hasZipMagic(input.bytes) || hasExcelOleMagic(input.bytes);
    if (!looksExcel) {
      return {
        error: "The file does not appear to be a valid Excel workbook.",
        ok: false,
      };
    }
    return { ok: true, format: "excel" };
  }

  return {
    error: "Only .xlsx, .xls, or .pdf files are allowed.",
    ok: false,
  };
}
