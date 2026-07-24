import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { parseAttendancePdf } from "@/lib/attendance/import/parse-pdf";
import { parseAttendancePdfText } from "@/lib/attendance/import/parse-pdf-text";
import { buildAttendanceTablePdf } from "../fixtures/attendance-pdf-builder";

/**
 * Integration: real unpdf extraction → PDF attendance parser.
 * Uses a small deterministic pipe-delimited table PDF fixture.
 */
describe("parseAttendancePdf integration (real unpdf)", () => {
  it("extracts and normalizes rows from a representative tabular PDF", async () => {
    const bytes = buildAttendanceTablePdf([
      "Employee Code | Employee Name | Shift | In Time | Out Time | Work Duration | OT | Status | Remarks",
      "EMP001 | Alice Smith | GS | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
      "EMP002 | Bob Jones | GS | 09:15 | 17:00 | 07:45 | 00:00 | Short Hours | Late",
    ]);

    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);

    const proxy = await getDocumentProxy(copy);
    const extracted = await extractText(proxy, { mergePages: true });
    expect(extracted.totalPages).toBeGreaterThanOrEqual(1);

    const text = String(extracted.text);
    expect(text).toMatch(/Employee Code/i);
    expect(text).toMatch(/EMP001/);

    // Parser path over the extracted text (deterministic) + full parseAttendancePdf
    const fromText = parseAttendancePdfText(text);
    expect(fromText.ok).toBe(true);
    if (!fromText.ok) return;
    expect(fromText.rows.some((r) => r.employeeCode === "EMP001")).toBe(true);

    const result = await parseAttendancePdf(bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    const alice = result.rows.find((r) => r.employeeCode === "EMP001");
    expect(alice?.inTime).toBe("09:00");
    expect(alice?.outTime).toBe("18:00");
  });
});
