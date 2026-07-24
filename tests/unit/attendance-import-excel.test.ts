import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseAttendanceExcel } from "@/lib/attendance/import/parse-excel";
import { formatTimeCell } from "@/lib/attendance/import/cell-utils";

function buildExcelBuffer(rows: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

const HEADER = [
  "Employee Code",
  "Employee Name",
  "Shift",
  "In Time",
  "Out Time",
  "Work Duration",
  "OT",
  "Status",
  "Remarks",
];

describe("parseAttendanceExcel (regression)", () => {
  it("parses a valid workbook with multiple employees", () => {
    const buffer = buildExcelBuffer([
      HEADER,
      ["EMP001", "Alice", "GS", "09:00", "18:00", "09:00", "00:00", "Present", ""],
      ["EMP002", "Bob", "GS", "09:30", "17:30", "08:00", "0", "Short Hours", "Late"],
    ]);

    const result = parseAttendanceExcel(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].employeeCode).toBe("EMP001");
    expect(result.rows[1].employeeName).toBe("Bob");
    expect(result.rows[1].remarks).toBe("Late");
  });

  it("accepts column aliases used by the existing importer", () => {
    const buffer = buildExcelBuffer([
      ["Emp Code", "Name", "Shift", "Check In", "Check Out", "Duration", "Overtime", "Status", "Remark"],
      ["E9", "Zed", "A", "08:00", "17:00", "09:00", "0", "Present", "ok"],
    ]);
    const result = parseAttendanceExcel(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].employeeCode).toBe("E9");
    expect(result.rows[0].inTime).toBe("08:00");
  });

  it("returns missing column errors unchanged in spirit", () => {
    const buffer = buildExcelBuffer([
      ["Employee Code", "Employee Name", "Shift"],
      ["EMP001", "Alice", "GS"],
    ]);
    const result = parseAttendanceExcel(buffer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Missing required column/);
  });

  it("skips rows without employee codes", () => {
    const buffer = buildExcelBuffer([
      HEADER,
      ["", "No Code", "GS", "09:00", "18:00", "09:00", "0", "Present", ""],
      ["EMP003", "Carol", "GS", "09:00", "18:00", "09:00", "0", "Present", ""],
    ]);
    const result = parseAttendanceExcel(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].employeeCode).toBe("EMP003");
  });

  it("reports empty workbook clearly", () => {
    const buffer = buildExcelBuffer([HEADER]);
    const result = parseAttendanceExcel(buffer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Excel file has no data rows.");
  });
});

describe("formatTimeCell (shared Excel/PDF — Excel string parity)", () => {
  it("formats Excel serial time fractions", () => {
    expect(formatTimeCell(0.5)).toBe("12:00");
  });

  it("preserves string times without HH:mm:ss re-normalization (Excel legacy)", () => {
    expect(formatTimeCell("9:05")).toBe("9:05");
    expect(formatTimeCell("09:05:00")).toBe("09:05:00");
  });

  it("returns null for empty values", () => {
    expect(formatTimeCell("")).toBeNull();
    expect(formatTimeCell(null)).toBeNull();
  });
});
