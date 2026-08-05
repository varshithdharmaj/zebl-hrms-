import { beforeEach, describe, expect, it, vi } from "vitest";
import { ATTENDANCE_UPLOAD_MAX_FILE_SIZE } from "@/lib/attendance/import/file-validation";
import { startOfDay } from "@/lib/utils";

const requireAdminSession = vi.fn();
const parseAttendanceFile = vi.fn();
const importAttendanceRows = vi.fn();
const validateAttendanceUploadFile = vi.fn();
const buildAttendanceImportPreview = vi.fn();
const putAttendancePreviewCache = vi.fn();
const getAttendancePreviewCache = vi.fn();
const deleteAttendancePreviewCache = vi.fn();

vi.mock("@/lib/auth-guards", () => ({
  requireAdminSession: (...args: unknown[]) => requireAdminSession(...args),
}));

vi.mock("@/lib/attendance/import/parse-dispatch", () => ({
  parseAttendanceFile: (...args: unknown[]) => parseAttendanceFile(...args),
}));

vi.mock("@/lib/attendance/import/import-records", () => ({
  importAttendanceRows: (...args: unknown[]) => importAttendanceRows(...args),
}));

vi.mock("@/lib/attendance/import/build-preview", () => ({
  buildAttendanceImportPreview: (...args: unknown[]) => buildAttendanceImportPreview(...args),
}));

vi.mock("@/lib/attendance/import/preview-cache", () => ({
  putAttendancePreviewCache: (...args: unknown[]) => putAttendancePreviewCache(...args),
  getAttendancePreviewCache: (...args: unknown[]) => getAttendancePreviewCache(...args),
  deleteAttendancePreviewCache: (...args: unknown[]) => deleteAttendancePreviewCache(...args),
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

import {
  cancelAttendancePreviewAction,
  confirmAttendanceImportAction,
  previewAttendanceAction,
} from "@/actions/upload-preview";

describe("preview / confirm attendance actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSession.mockResolvedValue({
      id: "hr-1",
      email: "hr@test.local",
      role: "hr",
      employeeId: null,
    });
  });

  it("rejects oversized files before parsing", async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(8));
    const formData = {
      get(name: string) {
        if (name === "file") {
          return {
            name: "huge.pdf",
            type: "application/pdf",
            size: ATTENDANCE_UPLOAD_MAX_FILE_SIZE + 1,
            arrayBuffer,
          };
        }
        if (name === "attendanceDate") return "2026-07-24";
        return null;
      },
    } as unknown as FormData;

    const result = await previewAttendanceAction({}, formData);
    expect(result.error).toMatch(/5MB/i);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(parseAttendanceFile).not.toHaveBeenCalled();
  });

  it("parses once, builds preview, and caches rows (Excel)", async () => {
    const pdfMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const arrayBuffer = vi.fn(async () => pdfMagic.buffer);
    validateAttendanceUploadFile.mockReturnValue({ ok: true, format: "excel" });
    parseAttendanceFile.mockResolvedValue({
      ok: true,
      reportType: "EXCEL_DAILY",
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
          source: "EXCEL_DAILY",
        },
      ],
    });
    buildAttendanceImportPreview.mockResolvedValue({
      previewId: "will-be-replaced",
      canConfirm: true,
      reportType: "EXCEL_DAILY",
      meta: {
        fileName: "ok.xlsx",
        fileSize: 4,
        format: "excel",
        reportType: "EXCEL_DAILY",
        formAttendanceDate: "2026-07-24",
        datesFromFile: false,
      },
      rows: [],
      summary: {
        totalRows: 1,
        validRows: 1,
        duplicateRows: 0,
        unknownEmployees: 0,
        warnings: 0,
        errors: 0,
        importableRows: 1,
        employeesDetected: 1,
        datesDetected: 1,
      },
      warnings: [],
      errors: [],
    });

    const formData = {
      get(name: string) {
        if (name === "file") {
          return {
            name: "ok.xlsx",
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            size: pdfMagic.byteLength,
            arrayBuffer,
          };
        }
        if (name === "attendanceDate") return "2026-07-24";
        return null;
      },
    } as unknown as FormData;

    const result = await previewAttendanceAction({}, formData);
    expect(result.error).toBeUndefined();
    expect(result.preview).toBeDefined();
    expect(parseAttendanceFile).toHaveBeenCalledTimes(1);
    expect(putAttendancePreviewCache).toHaveBeenCalledTimes(1);
    expect(importAttendanceRows).not.toHaveBeenCalled();
  });

  it("confirm imports from cache without re-parsing", async () => {
    const formDate = startOfDay(new Date("2026-07-24T00:00:00"));
    const rows = [
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
        source: "PDF_DAILY" as const,
      },
    ];
    getAttendancePreviewCache.mockReturnValue({
      previewId: "pid-1",
      userId: "hr-1",
      fileName: "day.pdf",
      fileSize: 10,
      format: "pdf",
      reportType: "PDF_DAILY",
      formAttendanceDate: formDate,
      rows,
      preview: {
        previewId: "pid-1",
        canConfirm: true,
        reportType: "PDF_DAILY",
        meta: {
          fileName: "day.pdf",
          fileSize: 10,
          format: "pdf",
          reportType: "PDF_DAILY",
          formAttendanceDate: "2026-07-24",
          datesFromFile: false,
        },
        rows: [
          {
            rowIndex: 0,
            employeeCode: "EMP001",
            employeeName: "A",
            attendanceDate: "2026-07-24",
            shift: "GS",
            inTime: "09:00",
            outTime: "18:00",
            status: "Present",
            workDuration: "09:00",
            validationStatus: "valid",
            messages: [],
            importable: true,
          },
        ],
        summary: {
          totalRows: 1,
          validRows: 1,
          duplicateRows: 0,
          unknownEmployees: 0,
          warnings: 0,
          errors: 0,
          importableRows: 1,
          employeesDetected: 1,
          datesDetected: 1,
        },
        warnings: [],
        errors: [],
      },
    });
    importAttendanceRows.mockResolvedValue({
      ok: true,
      imported: 1,
      skipped: 0,
      uploadId: 9,
      provisioningErrors: [],
      rejectedUnknownEmployees: [],
    });

    const formData = {
      get(name: string) {
        if (name === "previewId") return "pid-1";
        return null;
      },
    } as unknown as FormData;

    const result = await confirmAttendanceImportAction({}, formData);
    expect(result.success).toBeDefined();
    expect(result.imported).toBe(1);
    expect(parseAttendanceFile).not.toHaveBeenCalled();
    expect(importAttendanceRows).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "day.pdf",
        rows,
        source: "pdf",
      })
    );
    expect(deleteAttendancePreviewCache).toHaveBeenCalledWith("pid-1", "hr-1");
  });

  it("cancel deletes cached preview", async () => {
    deleteAttendancePreviewCache.mockReturnValue(true);
    const formData = {
      get(name: string) {
        if (name === "previewId") return "pid-2";
        return null;
      },
    } as unknown as FormData;
    const result = await cancelAttendancePreviewAction({}, formData);
    expect(result.cancelled).toBe(true);
    expect(deleteAttendancePreviewCache).toHaveBeenCalledWith("pid-2", "hr-1");
  });

  it("Summary preview allows missing form date", async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const arrayBuffer = vi.fn(async () => bytes.buffer);
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
          attendanceDate: startOfDay(new Date("2026-07-16T00:00:00")),
          source: "PDF_SUMMARY",
        },
      ],
    });
    buildAttendanceImportPreview.mockImplementation(async (input: { previewId: string }) => ({
      previewId: input.previewId,
      canConfirm: true,
      reportType: "PDF_SUMMARY",
      meta: {
        fileName: "sum.pdf",
        fileSize: 5,
        format: "pdf",
        reportType: "PDF_SUMMARY",
        formAttendanceDate: null,
        datesFromFile: true,
      },
      rows: [],
      summary: {
        totalRows: 1,
        validRows: 1,
        duplicateRows: 0,
        unknownEmployees: 0,
        warnings: 0,
        errors: 0,
        importableRows: 1,
        employeesDetected: 1,
        datesDetected: 1,
      },
      warnings: [],
      errors: [],
    }));

    const formData = {
      get(name: string) {
        if (name === "file") {
          return {
            name: "sum.pdf",
            type: "application/pdf",
            size: bytes.byteLength,
            arrayBuffer,
          };
        }
        if (name === "attendanceDate") return "";
        return null;
      },
    } as unknown as FormData;

    const result = await previewAttendanceAction({}, formData);
    expect(result.error).toBeUndefined();
    expect(result.preview?.meta.datesFromFile).toBe(true);
    expect(parseAttendanceFile).toHaveBeenCalledTimes(1);
  });
});
