import { beforeEach, describe, expect, it, vi } from "vitest";
import { ATTENDANCE_UPLOAD_MAX_FILE_SIZE } from "@/lib/attendance/import/file-validation";

const requireAdminSession = vi.fn();
const parseAttendanceExcel = vi.fn();
const parseAttendancePdf = vi.fn();
const importAttendanceRows = vi.fn();
const validateAttendanceUploadFile = vi.fn();

vi.mock("@/lib/auth-guards", () => ({
  requireAdminSession: (...args: unknown[]) => requireAdminSession(...args),
}));

vi.mock("@/lib/attendance/import/parse-excel", () => ({
  parseAttendanceExcel: (...args: unknown[]) => parseAttendanceExcel(...args),
}));

vi.mock("@/lib/attendance/import/parse-pdf", () => ({
  parseAttendancePdf: (...args: unknown[]) => parseAttendancePdf(...args),
}));

vi.mock("@/lib/attendance/import/import-records", () => ({
  importAttendanceRows: (...args: unknown[]) => importAttendanceRows(...args),
}));

vi.mock("@/lib/attendance/import/file-validation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/attendance/import/file-validation")>(
    "@/lib/attendance/import/file-validation"
  );
  return {
    ...actual,
    validateAttendanceUploadFile: (...args: unknown[]) => validateAttendanceUploadFile(...args),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { uploadAttendanceAction } from "@/actions/upload";

describe("uploadAttendanceAction — early size rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSession.mockResolvedValue({
      id: "hr-1",
      email: "hr@test.local",
      role: "hr",
      employeeId: null,
    });
  });

  it("rejects oversized files before calling arrayBuffer / parsers", async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(8));
    const oversized = {
      name: "huge.pdf",
      type: "application/pdf",
      size: ATTENDANCE_UPLOAD_MAX_FILE_SIZE + 1,
      arrayBuffer,
    };

    const formData = {
      get(name: string) {
        if (name === "file") return oversized;
        if (name === "attendanceDate") return "2026-07-24";
        return null;
      },
    } as unknown as FormData;

    const result = await uploadAttendanceAction({}, formData);

    expect(result.error).toBe("File size exceeds 5MB limit.");
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(parseAttendanceExcel).not.toHaveBeenCalled();
    expect(parseAttendancePdf).not.toHaveBeenCalled();
    expect(importAttendanceRows).not.toHaveBeenCalled();
    expect(validateAttendanceUploadFile).not.toHaveBeenCalled();
  });

  it("still buffers and validates files within the size limit", async () => {
    const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const arrayBuffer = vi.fn(async () => pdfMagic.buffer);
    const file = {
      name: "ok.pdf",
      type: "application/pdf",
      size: pdfMagic.byteLength,
      arrayBuffer,
    };

    validateAttendanceUploadFile.mockReturnValue({ ok: true, format: "pdf" });
    parseAttendancePdf.mockResolvedValue({
      ok: true,
      rows: [
        {
          employeeCode: "EMP001",
          employeeName: "A",
          shift: "GS",
          inTime: "09:00",
          outTime: "18:00",
          workDuration: "09:00",
          ot: "0",
          status: "Present",
          remarks: "",
        },
      ],
    });
    importAttendanceRows.mockResolvedValue({
      ok: true,
      imported: 1,
      skipped: 0,
      uploadId: 1,
      provisioningErrors: [],
      rejectedUnknownEmployees: [],
    });

    const formData = {
      get(name: string) {
        if (name === "file") return file;
        if (name === "attendanceDate") return "2026-07-24";
        return null;
      },
    } as unknown as FormData;

    const result = await uploadAttendanceAction({}, formData);
    expect(arrayBuffer).toHaveBeenCalledTimes(1);
    expect(parseAttendancePdf).toHaveBeenCalled();
    expect(result.success).toContain("Imported 1");
    expect(result.unknownEmployees).toBe(0);
  });
});
