import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { extractAttendancePdf } from "@/lib/attendance/import/extract-pdf";
import { parseAttendancePdf } from "@/lib/attendance/import/parse-pdf";
import { parseAttendancePdfText } from "@/lib/attendance/import/parse-pdf-text";
import { toMergedPdfText } from "@/lib/attendance/import/pdf-extraction-adapters";
import { buildAttendanceTablePdf } from "../fixtures/attendance-pdf-builder";

/**
 * Integration: real unpdf extraction → structured document + Daily parser.
 */
describe("parseAttendancePdf integration (real unpdf)", () => {
  it("extracts and normalizes rows from a representative tabular PDF", async () => {
    const bytes = buildAttendanceTablePdf([
      "Employee Code | Employee Name | Shift | In Time | Out Time | Work Duration | OT | Status | Remarks",
      "EMP001 | Alice Smith | GS | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
      "EMP002 | Bob Jones | GS | 09:15 | 17:00 | 07:45 | 00:00 | Short Hours | Late",
    ]);

    const result = await parseAttendancePdf(bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    const alice = result.rows.find((r) => r.employeeCode === "EMP001");
    expect(alice?.inTime).toBe("09:00");
    expect(alice?.outTime).toBe("18:00");
  });

  it("structured extraction preserves pages/items and merged text matches legacy unpdf", async () => {
    const bytes = buildAttendanceTablePdf([
      "Employee Code | Employee Name | Shift | In Time | Out Time | Work Duration | OT | Status | Remarks",
      "EMP001 | Alice Smith | GS | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
    ]);

    const structured = await extractAttendancePdf(bytes);
    expect(structured.document.totalPages).toBeGreaterThanOrEqual(1);
    expect(structured.document.pages).toHaveLength(structured.document.totalPages);
    expect(structured.document.pages[0].pageNumber).toBe(1);
    expect(structured.document.pages[0].items.length).toBeGreaterThan(0);
    expect(structured.document.pages[0].items[0]).toEqual(
      expect.objectContaining({
        text: expect.any(String),
        x: expect.any(Number),
        y: expect.any(Number),
      })
    );
    expect(structured.mergedText).toMatch(/Employee Code/i);
    expect(structured.mergedText).toMatch(/EMP001/);

    // Legacy unpdf mergePages:true — adapter must stay identical
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const proxy = await getDocumentProxy(copy);
    const legacy = await extractText(proxy, { mergePages: true });
    expect(structured.mergedText).toBe(String(legacy.text));

    // Page texts → same merge algorithm
    const fromPages = toMergedPdfText(structured.document.pages.map((p) => p.text));
    expect(fromPages).toBe(structured.mergedText);

    const fromText = parseAttendancePdfText(structured.mergedText);
    expect(fromText.ok).toBe(true);
  });
});
