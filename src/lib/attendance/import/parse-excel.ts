import * as XLSX from "xlsx";
import { validateExcelColumns } from "@/lib/attendance";
import { normalizeAttendanceMatrix } from "./normalize-matrix";
import type { AttendanceImportParseResult } from "./types";

const MAX_HEADER_SCAN_ROWS = 40;

function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
}

function rowHasAnyValue(row: unknown[]): boolean {
  return row.some((cell) => String(cell ?? "").trim().length > 0);
}

/**
 * Find a header row that matches the attendance column contract.
 * Skips title/blank rows common at the top of vendor exports.
 */
export function findAttendanceHeaderRow(
  rows: unknown[][]
): { headerIndex: number; headers: string[] } | null {
  const limit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    if (!rowHasAnyValue(row)) continue;
    const headers = row.map((h) => String(h ?? ""));
    if (!validateExcelColumns(headers)) {
      return { headerIndex: i, headers };
    }
  }
  return null;
}

function parseSheetRows(rows: unknown[][]): AttendanceImportParseResult | null {
  if (rows.length === 0 || !rows.some(rowHasAnyValue)) {
    return null;
  }

  const found = findAttendanceHeaderRow(rows);
  if (!found) {
    return null;
  }

  const dataRows = rows.slice(found.headerIndex + 1).map((row) => row as unknown[]);
  if (dataRows.every((row) => !rowHasAnyValue(row))) {
    return { ok: false, error: "Excel file has no data rows." };
  }

  return normalizeAttendanceMatrix(found.headers, dataRows);
}

/**
 * Parse an Excel workbook buffer into normalized attendance rows.
 * Skips empty leading sheets and title rows; uses the first sheet that
 * contains a recognizable attendance header + data.
 */
export function parseAttendanceExcel(buffer: Buffer): AttendanceImportParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    if (!workbook.SheetNames.length) {
      return { ok: false, error: "Excel file has no sheets." };
    }

    let lastColumnError: string | null = null;
    let sawAnyContent = false;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rows = sheetRows(sheet);
      if (!rows.some(rowHasAnyValue)) {
        continue;
      }
      sawAnyContent = true;

      const found = findAttendanceHeaderRow(rows);
      if (!found) {
        // Sheet has content but not our attendance columns — try next sheet
        const firstNonEmpty = rows.find(rowHasAnyValue);
        if (firstNonEmpty) {
          const probe = validateExcelColumns(firstNonEmpty.map((h) => String(h ?? "")));
          if (probe) lastColumnError = probe;
        }
        continue;
      }

      const parsed = parseSheetRows(rows);
      if (!parsed) continue;

      if (parsed.ok) {
        return parsed;
      }

      // Recognizable header but no usable employee rows — keep looking only if
      // this sheet truly has no codes; otherwise surface that error.
      if (parsed.error === "No valid employee rows found.") {
        lastColumnError = parsed.error;
        continue;
      }
      return parsed;
    }

    if (!sawAnyContent) {
      return {
        ok: false,
        error:
          "Excel file has no data rows. Empty sheets were skipped — put attendance data on a sheet with the required columns, or remove blank sheets at the front.",
      };
    }

    if (lastColumnError === "No valid employee rows found.") {
      return {
        ok: false,
        error:
          "No valid employee rows found. Check that Employee Code is filled on data rows (blank codes are skipped).",
      };
    }

    return {
      ok: false,
      error:
        lastColumnError
          ? `${lastColumnError}. If the file has multiple sheets, put the attendance table on the first non-empty sheet or ensure columns match the import template.`
          : "Excel file has no recognizable attendance table. Expected columns include Employee Code, Employee Name, Shift, In Time, Out Time, Work Duration, OT, Status, and Remarks.",
    };
  } catch {
    return {
      ok: false,
      error: "Failed to process Excel file. Please check the format.",
    };
  }
}
