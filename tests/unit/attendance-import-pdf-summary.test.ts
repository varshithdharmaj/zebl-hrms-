import { describe, expect, it } from "vitest";
import {
  parseAttendancePdfSummary,
  parseEsslSummaryAttendanceLineForTest,
  parseEsslSummaryDateForTest,
  SUMMARY_PDF_IMPORT_ERRORS,
} from "@/lib/attendance/import/parse-pdf-summary";
import { toISODate } from "@/lib/utils";
import {
  buildSummaryPdfDocumentFromLines,
  employeeSection,
  ESSL_SUMMARY_TABLE_HEADER,
} from "../fixtures/essl-summary-pdf";

describe("eSSL Summary date / line helpers", () => {
  it("parses eSSL date tokens", () => {
    const d = parseEsslSummaryDateForTest("16-Jul-2026");
    expect(d).not.toBeNull();
    expect(toISODate(d!)).toBe("2026-07-16");
    expect(toISODate(parseEsslSummaryDateForTest("01/07/2026")!)).toBe("2026-07-01");
    expect(toISODate(parseEsslSummaryDateForTest("01-07-26")!)).toBe("2026-07-01");
  });

  it("parses missing out-time and weekend rows", () => {
    const missingOut = parseEsslSummaryAttendanceLineForTest(
      "16-Jul-2026  09:00    GS  00:00  Absent"
    );
    expect(missingOut?.inTime).toBe("09:00");
    expect(missingOut?.outTime).toBe("");
    expect(missingOut?.shift).toBe("GS");
    expect(missingOut?.status).toBe("Absent");

    const weekend = parseEsslSummaryAttendanceLineForTest("17-Jul-2026  Weekly Off");
    expect(weekend?.inTime).toBe("");
    expect(weekend?.status.toLowerCase()).toContain("weekly");
  });
});

describe("parseAttendancePdfSummary (eSSL layout)", () => {
  it("parses a single employee section", () => {
    const doc = buildSummaryPdfDocumentFromLines([
      [
        "Summary Report",
        ...employeeSection({
          code: "660005",
          name: "Madhukar",
          rows: [
            "16-Jul-2026  09:00  18:00  GS  09:00  Present",
            "17-Jul-2026  09:15  18:05  GS  08:50  Present",
          ],
        }),
      ],
    ]);

    const result = parseAttendancePdfSummary(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].employeeCode).toBe("660005");
    expect(result.rows[0].employeeName).toBe("Madhukar");
    expect(result.rows[0].source).toBe("PDF_SUMMARY");
    expect(result.rows[0].attendanceDate).toBeDefined();
    expect(toISODate(result.rows[0].attendanceDate!)).toBe("2026-07-16");
    expect(result.rows[0].inTime).toBe("09:00");
    expect(result.rows[0].outTime).toBe("18:00");
  });

  it("parses multiple employees and never imports Totals as rows", () => {
    const doc = buildSummaryPdfDocumentFromLines([
      [
        "Summary Report — 15 Days",
        ...employeeSection({
          code: "660001",
          name: "Sowmya",
          rows: ["16-Jul-2026  09:00  18:00  GS  09:00  Present"],
        }),
        ...employeeSection({
          code: "660005",
          name: "Madhukar",
          rows: ["16-Jul-2026  07:52  17:03  GS  09:11  Present"],
        }),
        "Grand Totals",
      ],
    ]);

    const result = parseAttendancePdfSummary(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.employeeCode)).toEqual(["660001", "660005"]);
    expect(result.rows.every((r) => r.status !== "Totals")).toBe(true);
    expect(result.rows.every((r) => r.attendanceDate !== undefined)).toBe(true);
  });

  it("handles multiple pages with repeated headers", () => {
    const doc = buildSummaryPdfDocumentFromLines([
      [
        "Summary Report",
        "Page 1 of 2",
        ...employeeSection({
          code: "E100",
          name: "Alice",
          rows: ["16-Jul-2026  09:00  18:00  GS  09:00  Present"],
          includeTotals: false,
        }),
      ],
      [
        "Summary Report",
        "Page 2 of 2",
        ESSL_SUMMARY_TABLE_HEADER,
        "17-Jul-2026  09:00  18:00  GS  09:00  Present",
        "Totals",
        ...employeeSection({
          code: "E200",
          name: "Bob",
          rows: ["16-Jul-2026  10:00  19:00  GS  09:00  Present"],
        }),
      ],
    ]);

    const result = parseAttendancePdfSummary(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(3);
    expect(result.rows.filter((r) => r.employeeCode === "E100")).toHaveLength(2);
    expect(result.rows.filter((r) => r.employeeCode === "E200")).toHaveLength(1);
  });

  it("supports blank days, missing out time, weekend, holiday, and leave rows", () => {
    const doc = buildSummaryPdfDocumentFromLines([
      [
        "Attendance Summary",
        ...employeeSection({
          code: "E50",
          name: "Kapil",
          rows: [
            "16-Jul-2026  09:00  18:00  GS  09:00  Present",
            "17-Jul-2026  Weekly Off",
            "18-Jul-2026  Holiday",
            "19-Jul-2026  09:00    GS  00:00  Absent",
            "20-Jul-2026  On Leave",
            "21-Jul-2026",
          ],
        }),
      ],
    ]);

    const result = parseAttendancePdfSummary(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(6);

    const byDay = Object.fromEntries(
      result.rows.map((r) => [toISODate(r.attendanceDate!), r])
    );
    expect(byDay["2026-07-17"].status.toLowerCase()).toMatch(/week|off/);
    expect(byDay["2026-07-18"].status.toLowerCase()).toContain("holiday");
    expect(byDay["2026-07-19"].outTime).toBe("");
    expect(byDay["2026-07-19"].inTime).toBe("09:00");
    expect(byDay["2026-07-20"].status.toLowerCase()).toMatch(/leave/);
    expect(byDay["2026-07-21"].inTime).toBe("");
    expect(byDay["2026-07-21"].status).toBe("");
  });

  it("keeps employee context when a section splits across pages", () => {
    const doc = buildSummaryPdfDocumentFromLines([
      [
        "Summary Report",
        "Employee Code: 99001",
        "Employee Name: Split User",
        ESSL_SUMMARY_TABLE_HEADER,
        "01-Jul-2026  09:00  18:00  GS  09:00  Present",
        "02-Jul-2026  09:00  18:00  GS  09:00  Present",
      ],
      [
        "Page 2 of 2",
        ESSL_SUMMARY_TABLE_HEADER,
        "03-Jul-2026  09:00  18:00  GS  09:00  Present",
        "Totals",
      ],
    ]);

    const result = parseAttendancePdfSummary(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((r) => r.employeeCode === "99001")).toBe(true);
    expect(result.rows.map((r) => toISODate(r.attendanceDate!))).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
  });

  it("rejects documents with no employee sections", () => {
    const doc = buildSummaryPdfDocumentFromLines([
      ["Invoice", "Amount 100", "Thank you"],
    ]);
    const result = parseAttendancePdfSummary(doc);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(SUMMARY_PDF_IMPORT_ERRORS.NO_SECTIONS);
  });

  it("rejects employee sections without attendance rows", () => {
    const doc = buildSummaryPdfDocumentFromLines([
      [
        "Summary Report",
        "Employee Code: 1",
        "Employee Name: Empty",
        ESSL_SUMMARY_TABLE_HEADER,
        "Totals",
      ],
    ]);
    const result = parseAttendancePdfSummary(doc);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(SUMMARY_PDF_IMPORT_ERRORS.NO_ROWS);
  });

  it("rejects employee labels without a date table header", () => {
    const doc = buildSummaryPdfDocumentFromLines([
      [
        "Employee Code: 1",
        "Employee Name: No Table",
        "16-Jul-2026  09:00  18:00  Present",
        "Totals",
      ],
    ]);
    const result = parseAttendancePdfSummary(doc);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(SUMMARY_PDF_IMPORT_ERRORS.INVALID_STRUCTURE);
  });
});
