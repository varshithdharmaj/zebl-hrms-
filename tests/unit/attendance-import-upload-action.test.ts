import { beforeEach, describe, expect, it, vi } from "vitest";
import { ATTENDANCE_UPLOAD_MAX_FILE_SIZE } from "@/lib/attendance/import/file-validation";

const requireAdminSession = vi.fn();
const parseAttendanceFile = vi.fn();
const createAttendanceImportJob = vi.fn();
const processAttendanceImportJob = vi.fn();
const validateAttendanceUploadFile = vi.fn();

vi.mock("@/lib/auth-guards", () => ({
  requireAdminSession: (...args: unknown[]) => requireAdminSession(...args),
}));

vi.mock("@/lib/attendance/import/parse-dispatch", () => ({
  parseAttendanceFile: (...args: unknown[]) => parseAttendanceFile(...args),
}));

vi.mock("@/lib/attendance/import/import-job", () => ({
  createAttendanceImportJob: (...args: unknown[]) => createAttendanceImportJob(...args),
  processAttendanceImportJob: (...args: unknown[]) => processAttendanceImportJob(...args),
  resumeAttendanceImportJob: vi.fn(),
  listResumableAttendanceImportJobs: vi.fn(async () => []),
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
    expect(parseAttendanceFile).not.toHaveBeenCalled();
    expect(createAttendanceImportJob).not.toHaveBeenCalled();
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
    parseAttendanceFile.mockResolvedValue({
      ok: true,
      reportType: "PDF_DAILY",
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
          source: "PDF_DAILY",
        },
      ],
    });
    createAttendanceImportJob.mockResolvedValue({ ok: true, jobId: "job-1" });
    processAttendanceImportJob.mockResolvedValue({
      ok: true,
      jobId: "job-1",
      status: "COMPLETED",
      imported: 1,
      skipped: 0,
      employeesCreated: 0,
      usersCreated: 0,
      provisioningErrors: [],
      nextRowIndex: 1,
      totalRows: 1,
    });

    const formData = {
      get(name: string) {
        if (name === "file") return file;
        if (name === "attendanceDate") return "2026-07-24";
        return null;
      },
    } as unknown as FormData;

    const result = await uploadAttendanceAction({}, formData);

    expect(result.error).toBeUndefined();
    expect(parseAttendanceFile).toHaveBeenCalled();
    expect(createAttendanceImportJob).toHaveBeenCalled();
    expect(processAttendanceImportJob).toHaveBeenCalledWith("job-1", expect.anything());
  });

  it("allows Summary PDF import without a form attendance date", async () => {
    const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const arrayBuffer = vi.fn(async () => pdfMagic.buffer);
    const file = {
      name: "summary.pdf",
      type: "application/pdf",
      size: pdfMagic.byteLength,
      arrayBuffer,
    };

    validateAttendanceUploadFile.mockReturnValue({ ok: true, format: "pdf" });
    parseAttendanceFile.mockResolvedValue({
      ok: true,
      reportType: "PDF_SUMMARY",
      rows: [
        {
          employeeCode: "EMP001",
          employeeName: "A",
          shift: "GS",
          inTime: "09:00",
          outTime: "18:00",
          workDuration: "09:00",
          ot: "",
          status: "Present",
          remarks: "",
          attendanceDate: new Date(2026, 6, 16),
          source: "PDF_SUMMARY",
        },
      ],
    });
    createAttendanceImportJob.mockResolvedValue({ ok: true, jobId: "job-2" });
    processAttendanceImportJob.mockResolvedValue({
      ok: true,
      jobId: "job-2",
      status: "COMPLETED",
      imported: 1,
      skipped: 0,
      employeesCreated: 0,
      usersCreated: 0,
      provisioningErrors: [],
      nextRowIndex: 1,
      totalRows: 1,
    });

    const formData = {
      get(name: string) {
        if (name === "file") return file;
        if (name === "attendanceDate") return "";
        return null;
      },
    } as unknown as FormData;

    const result = await uploadAttendanceAction({}, formData);
    expect(result.error).toBeUndefined();
    expect(result.success).toBeDefined();
    expect(result.reportType).toBe("PDF_SUMMARY");
    expect(createAttendanceImportJob).toHaveBeenCalled();
  });
});
