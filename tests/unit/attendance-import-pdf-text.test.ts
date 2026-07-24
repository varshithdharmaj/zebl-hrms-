import { describe, expect, it } from "vitest";
import {
  parseAttendancePdfText,
  PDF_IMPORT_ERRORS,
  splitTableLine,
} from "@/lib/attendance/import/parse-pdf-text";

const PIPE_HEADER =
  "Employee Code | Employee Name | Shift | In Time | Out Time | Work Duration | OT | Status | Remarks";

const MULTI_HEADER =
  "Employee Code  Employee Name  Shift  In Time  Out Time  Work Duration  OT  Status  Remarks";

describe("splitTableLine", () => {
  it("splits pipe-delimited rows and preserves empty cells", () => {
    expect(splitTableLine("A |  | C")).toEqual(["A", "", "C"]);
  });

  it("splits tab-delimited rows", () => {
    expect(splitTableLine("A\tB\tC")).toEqual(["A", "B", "C"]);
  });

  it("splits multi-space rows", () => {
    expect(splitTableLine("A  B   C")).toEqual(["A", "B", "C"]);
  });

  it("does not invent columns from single-space compact lines", () => {
    expect(splitTableLine("EMP001 John Doe 09:00 18:00")).toEqual([
      "EMP001 John Doe 09:00 18:00",
    ]);
  });
});

describe("parseAttendancePdfText — supported layouts", () => {
  it("parses pipe-delimited tables", () => {
    const text = [
      "Daily Attendance Report",
      PIPE_HEADER,
      "EMP001 | Alice Smith | GS | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
      "EMP002 | Bob Jones | GS | 09:15 | 17:00 | 07:45 | 00:00 | Short Hours | Late",
    ].join("\n");

    const result = parseAttendancePdfText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].employeeCode).toBe("EMP001");
    expect(result.rows[1].remarks).toBe("Late");
  });

  it("parses tab-delimited tables", () => {
    const header =
      "Employee Code\tEmployee Name\tShift\tIn Time\tOut Time\tWork Duration\tOT\tStatus\tRemarks";
    const data =
      "E100\tJane Roe\tMorning\t08:30\t17:30\t09:00\t0\tPresent\t";
    expect(splitTableLine(header)).toHaveLength(9);
    expect(splitTableLine(data)).toHaveLength(9);
    const result = parseAttendancePdfText(`${header}\n${data}`);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
      })
    );
    if (!result.ok) return;
    expect(result.rows[0].employeeCode).toBe("E100");
    expect(result.rows[0].inTime).toBe("08:30");
  });

  it("parses stable multi-space tables with exact column counts", () => {
    const text = [
      MULTI_HEADER,
      "E100  Jane Roe  Morning  08:30  17:30  09:00  0  Present  ok",
    ].join("\n");

    const result = parseAttendancePdfText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].employeeName).toBe("Jane Roe");
  });

  it("supports column reordering when headers remain recognizable", () => {
    const text = [
      "In Time | Out Time | Employee Code | Employee Name | Shift | Work Duration | OT | Status | Remarks",
      "09:00 | 18:00 | EMP001 | Alice | GS | 09:00 | 0 | Present |",
    ].join("\n");
    const result = parseAttendancePdfText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].employeeCode).toBe("EMP001");
    expect(result.rows[0].inTime).toBe("09:00");
    expect(result.rows[0].outTime).toBe("18:00");
  });

  it("preserves empty shift cells in pipe layouts without shifting columns", () => {
    const text = [
      PIPE_HEADER,
      "EMP001 | John Doe |  | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
    ].join("\n");
    const result = parseAttendancePdfText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].employeeName).toBe("John Doe");
    expect(result.rows[0].shift).toBe("");
    expect(result.rows[0].inTime).toBe("09:00");
  });

  it("skips blank employee codes and keeps valid rows", () => {
    const text = [
      PIPE_HEADER,
      " |  | GS | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
      "EMP050 | Valid User | GS | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
    ].join("\n");
    const result = parseAttendancePdfText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].employeeCode).toBe("EMP050");
  });
});

describe("parseAttendancePdfText — reject ambiguous / noisy layouts", () => {
  it("rejects compact single-space layouts instead of guessing name/shift boundaries", () => {
    const text = [
      "Employee Code Employee Name Shift In Time Out Time Work Duration OT Status Remarks",
      "EMP001 John Doe 09:00 18:00 09:00 00:00 Present On time",
    ].join("\n");
    const result = parseAttendancePdfText(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(PDF_IMPORT_ERRORS.UNSUPPORTED_LAYOUT);
  });

  it("rejects multi-word names without a shift when multi-space columns collapse", () => {
    // Missing shift collapses columns → cell count ≠ header count → reject
    const text = [
      MULTI_HEADER,
      "EMP001  John Doe  09:00  18:00  09:00  00:00  Present  note",
    ].join("\n");
    const result = parseAttendancePdfText(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(PDF_IMPORT_ERRORS.UNSUPPORTED_LAYOUT);
  });

  it("ignores footer text and page-number noise", () => {
    const text = [
      PIPE_HEADER,
      "EMP001 | Alice | GS | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
      "Page 2 of 4",
      "Total employees 12",
      "Confidential — Zebl HR",
    ].join("\n");
    const result = parseAttendancePdfText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].employeeCode).toBe("EMP001");
  });

  it("skips repeated headers between pages", () => {
    const text = [
      PIPE_HEADER,
      "EMP001 | Alice | GS | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
      "Page 2",
      PIPE_HEADER,
      "EMP002 | Bob | GS | 10:00 | 19:00 | 09:00 | 00:00 | Present |",
    ].join("\n");
    const result = parseAttendancePdfText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => r.employeeCode)).toEqual(["EMP001", "EMP002"]);
  });

  it("rejects empty / scanned-like text", () => {
    expect(parseAttendancePdfText("   \n\t  ").ok).toBe(false);
    const nearEmpty = parseAttendancePdfText("..  \n  --");
    expect(nearEmpty.ok).toBe(false);
    if (nearEmpty.ok) return;
    expect(nearEmpty.error).toBe(PDF_IMPORT_ERRORS.NO_TEXT);
  });

  it("rejects unrelated documents", () => {
    const result = parseAttendancePdfText("Invoice Number Customer Amount\n100 Acme 50.00\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(PDF_IMPORT_ERRORS.UNSUPPORTED_LAYOUT);
  });

  it("does not invent rows from ambiguous multi-space fragments", () => {
    const text = [
      MULTI_HEADER,
      "Continued on next page",
      "EMPXYZ  only  three",
    ].join("\n");
    const result = parseAttendancePdfText(text);
    expect(result.ok).toBe(false);
  });
});
