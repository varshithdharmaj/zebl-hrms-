import { validateExcelColumns } from "@/lib/attendance";
import { normalizeAttendanceMatrix } from "./normalize-matrix";
import type { AttendanceImportParseResult } from "./types";

const NO_TEXT_ERROR =
  "This PDF does not contain extractable text (it may be a scanned/image-only PDF). For unsupported or complex reports, export the attendance data as Excel and upload the Excel file instead.";

const UNSUPPORTED_LAYOUT_ERROR =
  "Unsupported attendance PDF layout. Supported PDFs are structured attendance reports with recognizable tabular columns. For unsupported or complex reports, export the attendance data as Excel and upload the Excel file instead.";

/**
 * Split a table line into cells.
 * Supports pipe, tab, and multi-space (≥2 spaces) delimited layouts only.
 * Empty cells are preserved for pipe/tab so column positions stay aligned.
 * Do not trim the full line before splitting tabs/pipes — trailing delimiters encode empty cells.
 */
export function splitTableLine(line: string): string[] {
  const raw = line.replace(/\r$/, "");
  if (!raw.trim()) return [];

  if (raw.includes("|")) {
    return raw.split("|").map((c) => c.trim());
  }

  if (raw.includes("\t")) {
    return raw.split("\t").map((c) => c.trim());
  }

  const trimmed = raw.trim();
  // Multi-space only — single-space compact layouts are intentionally unsupported in v1
  if (/\s{2,}/.test(trimmed)) {
    return trimmed.split(/\s{2,}/).map((c) => c.trim());
  }

  return [trimmed];
}

function isLikelyHeaderLine(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  const hasCode =
    joined.includes("employee code") ||
    joined.includes("emp code") ||
    joined.includes("e. code") ||
    (cells.some((c) => /^(code|emp\.?\s*code)$/i.test(c.trim())) &&
      cells.some((c) => /name/i.test(c)));
  const hasIn = /in\s*time|check\s*in/i.test(joined);
  const hasOut = /out\s*time|check\s*out/i.test(joined);
  return hasCode && hasIn && hasOut;
}

function isConfidentDelimitedRow(line: string): boolean {
  return line.includes("|") || line.includes("\t") || /\s{2,}/.test(line);
}

/**
 * PDF.js often joins visual lines with spaces and merges the last header cell with the first
 * employee code. Restore confident pipe row boundaries without guessing name/shift tokens.
 * Only repair same-line merges (do not match across real newlines).
 */
export function repairPdfPipeExtraction(text: string): string {
  let repaired = text;
  // Same-line glue: "Remarks EMP001 |" → "Remarks | EMP001 |"
  repaired = repaired.replace(
    /\b(Remarks)[^\S\n]+([A-Za-z0-9._-]+)[^\S\n]*\|/gi,
    "$1 | $2 |"
  );
  // Same-line next row: "Present | EMP002 |" → break before next code
  repaired = repaired.replace(
    /\b(Present|Absent|Short Hours)[^\S\n]*\|[^\S\n]*([A-Za-z][A-Za-z0-9._-]*)[^\S\n]*\|/gi,
    "$1 |\n$2 |"
  );
  return repaired;
}

function parseDelimitedLines(text: string): AttendanceImportParseResult {
  // Preserve trailing tabs/pipes — only strip CR; do not trim each line fully
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^[ ]+/, "").replace(/[ ]+$/, ""))
    .filter((l) => l.trim().length > 0);

  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isConfidentDelimitedRow(line)) continue;
    const cells = splitTableLine(line);
    if (cells.length >= 5 && isLikelyHeaderLine(cells)) {
      headerIndex = i;
      headers = cells;
      break;
    }
  }

  if (headerIndex === -1 || headers.length === 0) {
    return { ok: false, error: UNSUPPORTED_LAYOUT_ERROR };
  }

  const dataRows: unknown[][] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^page\s+\d+/i.test(line) || /^total\b/i.test(line)) continue;
    if (!isConfidentDelimitedRow(line)) continue;

    const cells = splitTableLine(line);
    if (cells.length === 0) continue;
    if (isLikelyHeaderLine(cells)) continue;
    if (cells.length !== headers.length) continue;
    if (cells.every((v) => !v)) continue;
    dataRows.push(cells);
  }

  if (dataRows.length === 0) {
    return { ok: false, error: UNSUPPORTED_LAYOUT_ERROR };
  }

  const result = normalizeAttendanceMatrix(headers, dataRows);
  if (!result.ok) {
    if (result.error.startsWith("Missing required column:")) {
      return {
        ok: false,
        error: `${result.error}. ${UNSUPPORTED_LAYOUT_ERROR}`,
      };
    }
    return result;
  }
  return result;
}

/**
 * When PDF.js collapses a pipe table into one line, chunk pipe cells after a recognized header.
 * Still requires pipe delimiters — does not infer compact single-space columns.
 */
function parsePipeCellStream(text: string): AttendanceImportParseResult {
  if (!text.includes("|")) {
    return { ok: false, error: UNSUPPORTED_LAYOUT_ERROR };
  }

  const cells = text.split("|").map((c) => c.trim());
  let headerStart = -1;
  for (let i = 0; i < cells.length; i++) {
    if (/^(employee code|emp\.?\s*code|e\.?\s*code)$/i.test(cells[i])) {
      headerStart = i;
      break;
    }
  }
  if (headerStart < 0) {
    return { ok: false, error: UNSUPPORTED_LAYOUT_ERROR };
  }

  for (const width of [9, 8, 10, 7]) {
    const headers = cells.slice(headerStart, headerStart + width);
    if (headers.length < width) continue;
    if (!isLikelyHeaderLine(headers)) continue;
    if (validateExcelColumns(headers)) continue;

    const rest = cells.slice(headerStart + width);
    const dataRows: unknown[][] = [];
    for (let i = 0; i + width <= rest.length; i += width) {
      const chunk = rest.slice(i, i + width);
      if (isLikelyHeaderLine(chunk)) continue;
      if (chunk.every((c) => !c)) continue;
      if (!String(chunk[0] ?? "").trim()) continue;
      dataRows.push(chunk);
    }
    if (dataRows.length === 0) continue;

    const result = normalizeAttendanceMatrix(headers, dataRows);
    if (result.ok) return result;
  }

  return { ok: false, error: UNSUPPORTED_LAYOUT_ERROR };
}

/**
 * Parse attendance rows from already-extracted PDF text.
 * v1: only confidently delimited tables (pipe / tab / multi-space). Ambiguous layouts are rejected.
 */
export function parseAttendancePdfText(text: string): AttendanceImportParseResult {
  // Normalize newlines only — do not trim tabs/pipes (they encode empty trailing cells)
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.trim()) {
    return { ok: false, error: NO_TEXT_ERROR };
  }

  const alphanumeric = normalized.replace(/[^a-zA-Z0-9]/g, "");
  if (alphanumeric.length < 12) {
    return { ok: false, error: NO_TEXT_ERROR };
  }

  const repaired = repairPdfPipeExtraction(normalized);
  const lineResult = parseDelimitedLines(repaired);
  if (lineResult.ok) return lineResult;

  // Fallback for pipe tables collapsed onto one extracted line
  if (repaired.includes("|")) {
    const streamResult = parsePipeCellStream(repaired);
    if (streamResult.ok) return streamResult;
  }

  return lineResult;
}

export const PDF_IMPORT_ERRORS = {
  NO_TEXT: NO_TEXT_ERROR,
  UNSUPPORTED_LAYOUT: UNSUPPORTED_LAYOUT_ERROR,
} as const;
