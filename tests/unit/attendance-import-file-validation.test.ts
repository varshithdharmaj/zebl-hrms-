import { describe, expect, it } from "vitest";
import { validateAttendanceUploadFile } from "@/lib/attendance/import/file-validation";

function pdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
}

function zipBytes(): Uint8Array {
  // PK zip local file header signature
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
}

function oleBytes(): Uint8Array {
  return new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

describe("validateAttendanceUploadFile", () => {
  it("accepts a PDF with valid magic bytes", () => {
    const result = validateAttendanceUploadFile({
      fileName: "attendance.pdf",
      mimeType: "application/pdf",
      size: 100,
      bytes: pdfBytes(),
    });
    expect(result).toEqual({ ok: true, format: "pdf" });
  });

  it("rejects a .pdf extension without PDF magic bytes", () => {
    const result = validateAttendanceUploadFile({
      fileName: "fake.pdf",
      mimeType: "application/pdf",
      size: 10,
      bytes: new TextEncoder().encode("not a pdf"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("valid PDF");
  });

  it("accepts .xlsx with ZIP magic", () => {
    const result = validateAttendanceUploadFile({
      fileName: "sheet.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 20,
      bytes: zipBytes(),
    });
    expect(result).toEqual({ ok: true, format: "excel" });
  });

  it("accepts .xls with OLE magic", () => {
    const result = validateAttendanceUploadFile({
      fileName: "sheet.xls",
      mimeType: "application/vnd.ms-excel",
      size: 20,
      bytes: oleBytes(),
    });
    expect(result).toEqual({ ok: true, format: "excel" });
  });

  it("rejects empty files", () => {
    const result = validateAttendanceUploadFile({
      fileName: "empty.pdf",
      mimeType: "application/pdf",
      size: 0,
      bytes: new Uint8Array(),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects oversized files", () => {
    const result = validateAttendanceUploadFile({
      fileName: "big.pdf",
      mimeType: "application/pdf",
      size: 6 * 1024 * 1024,
      bytes: pdfBytes(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("5MB");
  });

  it("rejects unsupported extensions", () => {
    const result = validateAttendanceUploadFile({
      fileName: "notes.docx",
      mimeType: "application/octet-stream",
      size: 10,
      bytes: zipBytes(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(".pdf");
  });
});
