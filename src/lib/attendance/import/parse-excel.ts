import * as XLSX from "xlsx";
import { normalizeAttendanceMatrix } from "./normalize-matrix";
import type { AttendanceImportParseResult } from "./types";

/**
 * Parse an Excel workbook buffer into normalized attendance rows.
 * Preserves existing first-sheet / header-row behavior.
 */
export function parseAttendanceExcel(buffer: Buffer): AttendanceImportParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { ok: false, error: "Excel file has no sheets." };

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

    if (rows.length < 2) {
      return { ok: false, error: "Excel file has no data rows." };
    }

    const headers = (rows[0] as unknown[]).map((h) => String(h ?? ""));
    const dataRows = rows.slice(1).map((row) => row as unknown[]);
    return normalizeAttendanceMatrix(headers, dataRows);
  } catch {
    return {
      ok: false,
      error: "Failed to process Excel file. Please check the format.",
    };
  }
}
