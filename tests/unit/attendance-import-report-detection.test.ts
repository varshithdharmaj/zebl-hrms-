import { describe, expect, it } from "vitest";
import { detectAttendanceReportType } from "@/lib/attendance/import/detect-report-type";

describe("detectAttendanceReportType", () => {
  it("classifies Excel uploads as EXCEL_DAILY from format", () => {
    const result = detectAttendanceReportType({
      format: "excel",
      fileName: "attendance.xlsx",
    });
    expect(result.type).toBe("EXCEL_DAILY");
    expect(result.reasons).toContain("format:excel");
  });

  it("classifies Excel uploads as EXCEL_DAILY from extension when format omitted", () => {
    const result = detectAttendanceReportType({
      fileName: "biometric.xls",
    });
    expect(result.type).toBe("EXCEL_DAILY");
  });

  it("detects PDF Daily from daily title and flat headers", () => {
    const result = detectAttendanceReportType({
      format: "pdf",
      fileName: "daily.pdf",
      extractedText: [
        "Daily Attendance Report",
        "Employee Code | Employee Name | Shift | In Time | Out Time | Work Duration | OT | Status | Remarks",
        "EMP001 | Alice | GS | 09:00 | 18:00 | 09:00 | 0 | Present |",
      ].join("\n"),
    });
    expect(result.type).toBe("PDF_DAILY");
    expect(result.reasons.some((r) => r.includes("daily") || r.includes("flat"))).toBe(
      true
    );
  });

  it("detects PDF Daily from eSSL biometric-style headers", () => {
    const result = detectAttendanceReportType({
      format: "pdf",
      headers: [
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
        "Status",
        "Punch Records",
      ],
    });
    expect(result.type).toBe("PDF_DAILY");
  });

  it("detects PDF Summary from Summary Report title", () => {
    const result = detectAttendanceReportType({
      format: "pdf",
      fileName: "summary.pdf",
      extractedText: [
        "Summary Report",
        "Employee Code 660005",
        "Employee Name Madhukar",
        "Date In Time Out Time Shift Total Duration Status Remarks",
        "01-07-2026 09:00 18:00 GS 09:00 Present",
        "Totals",
      ].join("\n"),
    });
    expect(result.type).toBe("PDF_SUMMARY");
    expect(result.reasons.some((r) => r.startsWith("title:"))).toBe(true);
  });

  it("detects PDF Summary from sectioned date-table structure", () => {
    const result = detectAttendanceReportType({
      format: "pdf",
      extractedText: [
        "Employee Code: 660001",
        "Employee Name: Sowmya",
        "Date  In Time  Out Time  Shift  Total Duration  Status  Remarks",
        "01-07-2026  09:00  18:00  GS  09:00  Present",
        "Totals  09:00",
        "Employee Code: 660005",
        "Employee Name: Madhukar",
        "Date  In Time  Out Time  Shift  Total Duration  Status  Remarks",
        "02-07-2026  09:15  18:00  GS  08:45  Present",
        "Totals  08:45",
      ].join("\n"),
    });
    expect(result.type).toBe("PDF_SUMMARY");
  });

  it("does not classify Daily Attendance as Summary when both words appear weakly", () => {
    const result = detectAttendanceReportType({
      format: "pdf",
      extractedText: [
        "Daily Attendance Report",
        "Employee Code | Employee Name | Shift | In Time | Out Time | Work Duration | OT | Status | Remarks",
        "EMP001 | Alice | GS | 09:00 | 18:00 | 09:00 | 0 | Present |",
        "Total employees 12",
      ].join("\n"),
    });
    expect(result.type).toBe("PDF_DAILY");
  });

  it("returns UNKNOWN for unrecognized extensions without format", () => {
    const result = detectAttendanceReportType({
      fileName: "notes.txt",
      extractedText: "hello",
    });
    expect(result.type).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for PDF with no extractable text", () => {
    const result = detectAttendanceReportType({
      format: "pdf",
      fileName: "empty.pdf",
      extractedText: "   ",
    });
    expect(result.type).toBe("UNKNOWN");
    expect(result.reasons).toContain("pdf:no-extractable-text");
  });

  it("defaults unclassified PDF text to PDF_DAILY (existing parser decides)", () => {
    const result = detectAttendanceReportType({
      format: "pdf",
      extractedText: "Invoice Number Customer Amount 100 Acme 50.00",
    });
    expect(result.type).toBe("PDF_DAILY");
    expect(result.reasons).toContain("pdf:default-daily-candidate");
  });
});
