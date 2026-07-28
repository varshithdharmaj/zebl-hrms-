import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  getColumnIndex,
  validateExcelColumns,
} from "@/lib/attendance";
import { parseAttendanceExcel } from "@/lib/attendance/import/parse-excel";
import { deriveAttendanceStatus, parseDurationToMinutes, parseOTToMinutes } from "@/lib/attendance";
import { formatTimeCell } from "@/lib/attendance/import/cell-utils";

const BIOMETRIC_HEADER = [
  "SN",
  "E. Code",
  "Name",
  "Shift",
  "S. InTime",
  "S. OutTime",
  "A. InTime",
  "A. OutTime",
  "Work Dur.",
  "OT",
  "Tot. Dur.",
  "LateBy",
  "EarlyGoingBy",
  "Status",
  "Punch Records",
  "Remarks",
];

function buildExcelBuffer(rows: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("biometric export header aliases", () => {
  it("resolves biometric headers to canonical fields", () => {
    expect(validateExcelColumns(BIOMETRIC_HEADER)).toBeNull();
    expect(getColumnIndex(BIOMETRIC_HEADER, "Employee Code")).toBe(1);
    expect(getColumnIndex(BIOMETRIC_HEADER, "Employee Name")).toBe(2);
    expect(getColumnIndex(BIOMETRIC_HEADER, "Shift")).toBe(3);
    expect(getColumnIndex(BIOMETRIC_HEADER, "In Time")).toBe(6); // A. InTime
    expect(getColumnIndex(BIOMETRIC_HEADER, "Out Time")).toBe(7); // A. OutTime
    expect(getColumnIndex(BIOMETRIC_HEADER, "Work Duration")).toBe(8);
    expect(getColumnIndex(BIOMETRIC_HEADER, "OT")).toBe(9);
    expect(getColumnIndex(BIOMETRIC_HEADER, "Status")).toBe(13);
    expect(getColumnIndex(BIOMETRIC_HEADER, "Remarks")).toBe(15);
  });

  it("never maps scheduled S. InTime / S. OutTime as actual punches", () => {
    expect(getColumnIndex(BIOMETRIC_HEADER, "In Time")).not.toBe(4);
    expect(getColumnIndex(BIOMETRIC_HEADER, "Out Time")).not.toBe(5);
    expect(getColumnIndex(BIOMETRIC_HEADER, "In Time")).toBe(
      BIOMETRIC_HEADER.indexOf("A. InTime")
    );
    expect(getColumnIndex(BIOMETRIC_HEADER, "Out Time")).toBe(
      BIOMETRIC_HEADER.indexOf("A. OutTime")
    );
  });

  it("ignores extra biometric columns during validation", () => {
    expect(validateExcelColumns(BIOMETRIC_HEADER)).toBeNull();
  });
});

describe("biometric Excel import", () => {
  it("parses a realistic biometric row into canonical attendance values", () => {
    const buffer = buildExcelBuffer([
      BIOMETRIC_HEADER,
      [
        1,
        "EMP001",
        "Test Employee",
        "General",
        "09:00", // S. InTime — must not become check-in
        "18:00", // S. OutTime — must not become check-out
        "09:12", // A. InTime
        "18:45", // A. OutTime
        "09:33", // Work Dur.
        "00:45", // OT
        "09:33", // Tot. Dur.
        "00:12", // LateBy
        "00:00", // EarlyGoingBy
        "Late", // Status (folded into remarks if remarks blank; DB status recalculated)
        "09:12:00(IN) 18:45:00(OUT)",
        "", // Remarks blank — valid
      ],
    ]);

    const result = parseAttendanceExcel(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows[0];
    expect(row.employeeCode).toBe("EMP001");
    expect(row.employeeName).toBe("Test Employee");
    expect(row.shift).toBe("General");
    expect(row.inTime).toBe("09:12");
    expect(row.outTime).toBe("18:45");
    expect(row.workDuration).toBe("09:33");
    expect(row.ot).toBe("00:45");
    expect(row.status).toBe("Late");
    expect(row.remarks).toBe("");

    // Same rules as import persistence layer
    const checkIn = formatTimeCell(row.inTime);
    const checkOut = formatTimeCell(row.outTime);
    const workedMinutes = parseDurationToMinutes(row.workDuration);
    const overtimeMinutes = parseOTToMinutes(row.ot);
    expect(checkIn).toBe("09:12");
    expect(checkOut).toBe("18:45");
    expect(workedMinutes).toBe(9 * 60 + 33);
    expect(overtimeMinutes).toBe(45);
    expect(deriveAttendanceStatus(checkIn, workedMinutes)).toBe("Present");
  });

  it("does not treat Punch Records as Remarks", () => {
    const headersWithoutRemarks = BIOMETRIC_HEADER.filter((h) => h !== "Remarks");
    expect(validateExcelColumns(headersWithoutRemarks)).toMatch(/Missing required column: Remarks/);
    expect(getColumnIndex(headersWithoutRemarks, "Remarks")).toBe(-1);
  });

  it("accepts blank Remarks cells when the Remarks column is present", () => {
    const buffer = buildExcelBuffer([
      BIOMETRIC_HEADER,
      [
        2,
        "EMP002",
        "Jane Doe",
        "General",
        "09:00",
        "18:00",
        "09:00",
        "18:00",
        "09:00",
        "00:00",
        "09:00",
        "00:00",
        "00:00",
        "Present",
        "punches…",
        "",
      ],
    ]);
    const result = parseAttendanceExcel(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].remarks).toBe("");
  });
});
