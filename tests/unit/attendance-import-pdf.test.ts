import { beforeEach, describe, expect, it, vi } from "vitest";

const extractAttendancePdf = vi.fn();

vi.mock("@/lib/attendance/import/extract-pdf", () => ({
  extractAttendancePdf: (...args: unknown[]) => extractAttendancePdf(...args),
}));

import { parseAttendancePdf } from "@/lib/attendance/import/parse-pdf";
import { PDF_IMPORT_ERRORS } from "@/lib/attendance/import/parse-pdf-text";
import {
  buildSummaryPdfDocumentFromLines,
  employeeSection,
} from "../fixtures/essl-summary-pdf";
import { toISODate } from "@/lib/utils";

function extractionFromMerged(mergedText: string, totalPages = 1) {
  return {
    mergedText,
    document: {
      totalPages,
      pages: Array.from({ length: totalPages }, (_, i) => ({
        pageNumber: i + 1,
        text: i === 0 ? mergedText : "",
        items: [],
      })),
    },
  };
}

describe("parseAttendancePdf (extraction adapter + report detection)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps extracted delimited text into normalized rows", async () => {
    extractAttendancePdf.mockResolvedValue(
      extractionFromMerged(
        [
          "Employee Code | Employee Name | Shift | In Time | Out Time | Work Duration | OT | Status | Remarks",
          "EMP001 | Alice Smith | GS | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
        ].join("\n")
      )
    );

    const result = await parseAttendancePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reportType).toBe("PDF_DAILY");
    expect(result.rows[0].employeeCode).toBe("EMP001");
  });

  it("rejects compact single-space extraction instead of guessing", async () => {
    extractAttendancePdf.mockResolvedValue(
      extractionFromMerged(
        [
          "Employee Code Employee Name Shift In Time Out Time Work Duration OT Status Remarks",
          "EMP001 John Doe GS 09:00 18:00 09:00 00:00 Present",
        ].join("\n")
      )
    );

    const result = await parseAttendancePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(PDF_IMPORT_ERRORS.UNSUPPORTED_LAYOUT);
  });

  it("returns a clear error for PDFs with no extractable text", async () => {
    extractAttendancePdf.mockResolvedValue(extractionFromMerged("   "));
    const result = await parseAttendancePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(PDF_IMPORT_ERRORS.NO_TEXT);
    expect(result.reportType).toBe("UNKNOWN");
  });

  it("returns a clear error for corrupted PDF bytes", async () => {
    extractAttendancePdf.mockRejectedValue(new Error("Invalid PDF structure."));
    const result = await parseAttendancePdf(new TextEncoder().encode("%PDF-1.4 corrupted"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.toLowerCase()).toMatch(/corrupt|failed to process/);
  });

  it("dispatches Summary PDFs to the eSSL Summary parser (not hard-reject)", async () => {
    const document = buildSummaryPdfDocumentFromLines([
      [
        "Summary Report — 15 Days",
        ...employeeSection({
          code: "660005",
          name: "Madhukar",
          rows: [
            "16-Jul-2026  09:00  18:00  GS  09:00  Present",
            "17-Jul-2026  Weekly Off",
          ],
        }),
        ...employeeSection({
          code: "660001",
          name: "Sowmya",
          rows: ["16-Jul-2026  09:30  18:00  GS  08:30  Present"],
        }),
      ],
    ]);

    extractAttendancePdf.mockResolvedValue({
      document,
      mergedText: document.pages.map((p) => p.text).join("\n").replace(/\s+/g, " "),
    });

    const result = await parseAttendancePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      fileName: "summary.pdf",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reportType).toBe("PDF_SUMMARY");
    expect(result.rows.length).toBeGreaterThanOrEqual(3);
    expect(result.rows.every((r) => r.source === "PDF_SUMMARY")).toBe(true);
    expect(result.rows.every((r) => r.attendanceDate !== undefined)).toBe(true);
    expect(toISODate(result.rows[0].attendanceDate!)).toBe("2026-07-16");
  });
});
