import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocumentProxy = vi.fn();
const extractText = vi.fn();

vi.mock("unpdf", () => ({
  getDocumentProxy: (...args: unknown[]) => getDocumentProxy(...args),
  extractText: (...args: unknown[]) => extractText(...args),
}));

import { parseAttendancePdf } from "@/lib/attendance/import/parse-pdf";
import { PDF_IMPORT_ERRORS } from "@/lib/attendance/import/parse-pdf-text";

describe("parseAttendancePdf (unpdf wiring)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocumentProxy.mockResolvedValue({ stub: true });
  });

  it("maps extracted delimited text into normalized rows", async () => {
    extractText.mockResolvedValue({
      totalPages: 1,
      text: [
        "Employee Code | Employee Name | Shift | In Time | Out Time | Work Duration | OT | Status | Remarks",
        "EMP001 | Alice Smith | GS | 09:00 | 18:00 | 09:00 | 00:00 | Present |",
      ].join("\n"),
    });

    const result = await parseAttendancePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].employeeCode).toBe("EMP001");
  });

  it("rejects compact single-space extraction instead of guessing", async () => {
    extractText.mockResolvedValue({
      totalPages: 1,
      text: [
        "Employee Code Employee Name Shift In Time Out Time Work Duration OT Status Remarks",
        "EMP001 John Doe GS 09:00 18:00 09:00 00:00 Present",
      ].join("\n"),
    });

    const result = await parseAttendancePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(PDF_IMPORT_ERRORS.UNSUPPORTED_LAYOUT);
  });

  it("returns a clear error for PDFs with no extractable text", async () => {
    extractText.mockResolvedValue({ totalPages: 1, text: "   " });
    const result = await parseAttendancePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(PDF_IMPORT_ERRORS.NO_TEXT);
  });

  it("returns a clear error for corrupted PDF bytes", async () => {
    getDocumentProxy.mockRejectedValue(new Error("Invalid PDF structure."));
    const result = await parseAttendancePdf(new TextEncoder().encode("%PDF-1.4 corrupted"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.toLowerCase()).toMatch(/corrupt|failed to process/);
  });
});
