import {
  getColumnIndex,
  validateExcelColumns,
} from "@/lib/attendance";
import { cellValue } from "./cell-utils";
import type { AttendanceImportParseResult, AttendanceImportRow } from "./types";

type ColumnIndexMap = {
  code: number;
  name: number;
  shift: number;
  inTime: number;
  outTime: number;
  workDuration: number;
  ot: number;
  status: number;
  remarks: number;
};

export function buildColumnIndexMap(headers: string[]): ColumnIndexMap {
  return {
    code: getColumnIndex(headers, "Employee Code"),
    name: getColumnIndex(headers, "Employee Name"),
    shift: getColumnIndex(headers, "Shift"),
    inTime: getColumnIndex(headers, "In Time"),
    outTime: getColumnIndex(headers, "Out Time"),
    workDuration: getColumnIndex(headers, "Work Duration"),
    ot: getColumnIndex(headers, "OT"),
    status: getColumnIndex(headers, "Status"),
    remarks: getColumnIndex(headers, "Remarks"),
  };
}

export function mapRowToAttendanceImportRow(
  row: unknown[],
  idx: ColumnIndexMap
): AttendanceImportRow | null {
  const employeeCode = cellValue(row, idx.code);
  if (!employeeCode) return null;

  return {
    employeeCode,
    employeeName: cellValue(row, idx.name),
    shift: cellValue(row, idx.shift),
    inTime: idx.inTime >= 0 ? row[idx.inTime] : "",
    outTime: idx.outTime >= 0 ? row[idx.outTime] : "",
    workDuration: cellValue(row, idx.workDuration),
    ot: idx.ot >= 0 ? (row[idx.ot] as string | number | null | undefined) : "",
    status: cellValue(row, idx.status),
    remarks: cellValue(row, idx.remarks),
  };
}

/**
 * Convert a header + data matrix (Excel-style) into normalized import rows.
 * Shared by Excel and PDF table parsers.
 */
export function normalizeAttendanceMatrix(
  headers: string[],
  dataRows: unknown[][]
): AttendanceImportParseResult {
  const columnError = validateExcelColumns(headers);
  if (columnError) return { ok: false, error: columnError };

  const idx = buildColumnIndexMap(headers);
  const rows: AttendanceImportRow[] = [];

  for (const row of dataRows) {
    const mapped = mapRowToAttendanceImportRow(row, idx);
    if (mapped) rows.push(mapped);
  }

  if (rows.length === 0) {
    return { ok: false, error: "No valid employee rows found." };
  }

  return { ok: true, rows };
}
