import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceImportRow } from "@/lib/attendance/import/types";
import { startOfDay } from "@/lib/utils";

const employeeFindMany = vi.fn();
const attendanceFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findMany: (...args: unknown[]) => employeeFindMany(...args),
    },
    attendanceRecord: {
      findMany: (...args: unknown[]) => attendanceFindMany(...args),
    },
  },
}));

import { buildAttendanceImportPreview } from "@/lib/attendance/import/build-preview";
import {
  clearAttendancePreviewCacheForTests,
  getAttendancePreviewCache,
  putAttendancePreviewCache,
  deleteAttendancePreviewCache,
} from "@/lib/attendance/import/preview-cache";

function row(
  partial: Partial<AttendanceImportRow> & { employeeCode: string }
): AttendanceImportRow {
  return {
    employeeCode: partial.employeeCode,
    employeeName: partial.employeeName ?? "Test",
    shift: partial.shift ?? "GS",
    inTime: partial.inTime ?? "09:00",
    outTime: partial.outTime ?? "18:00",
    workDuration: partial.workDuration ?? "09:00",
    ot: partial.ot ?? "0",
    status: partial.status ?? "Present",
    remarks: partial.remarks ?? "",
    attendanceDate: partial.attendanceDate,
    source: partial.source ?? "EXCEL_DAILY",
  };
}

describe("preview cache", () => {
  beforeEach(() => {
    clearAttendancePreviewCacheForTests();
  });

  it("stores and retrieves by previewId + userId", () => {
    const previewId = "p1";
    putAttendancePreviewCache({
      previewId,
      userId: "u1",
      fileName: "a.xlsx",
      fileSize: 10,
      format: "excel",
      reportType: "EXCEL_DAILY",
      formAttendanceDate: startOfDay(new Date("2026-07-24T00:00:00")),
      rows: [],
      preview: {
        previewId,
        meta: {
          fileName: "a.xlsx",
          fileSize: 10,
          format: "excel",
          reportType: "EXCEL_DAILY",
          formAttendanceDate: "2026-07-24",
          datesFromFile: false,
        },
        reportType: "EXCEL_DAILY",
        rows: [],
        summary: {
          totalRows: 0,
          validRows: 0,
          duplicateRows: 0,
          unknownEmployees: 0,
          warnings: 0,
          errors: 0,
          importableRows: 0,
          employeesDetected: 0,
          datesDetected: 0,
        },
        warnings: [],
        errors: [],
        canConfirm: false,
      },
    });

    expect(getAttendancePreviewCache(previewId, "u1")?.fileName).toBe("a.xlsx");
    expect(getAttendancePreviewCache(previewId, "other")).toBeNull();
    expect(deleteAttendancePreviewCache(previewId, "u1")).toBe(true);
    expect(getAttendancePreviewCache(previewId, "u1")).toBeNull();
  });
});

describe("buildAttendanceImportPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    employeeFindMany.mockResolvedValue([{ id: 1, employeeCode: "EMP001" }]);
    attendanceFindMany.mockResolvedValue([]);
  });

  it("marks Excel rows valid and uses form date when row date absent", async () => {
    const formDate = startOfDay(new Date("2026-07-24T00:00:00"));
    const preview = await buildAttendanceImportPreview({
      previewId: "x1",
      fileName: "daily.xlsx",
      fileSize: 100,
      format: "excel",
      reportType: "EXCEL_DAILY",
      formAttendanceDate: formDate,
      rows: [row({ employeeCode: "EMP001", source: "EXCEL_DAILY" })],
    });

    expect(preview.rows[0].attendanceDate).toBe("2026-07-24");
    expect(preview.rows[0].validationStatus).toBe("valid");
    expect(preview.canConfirm).toBe(true);
    expect(preview.meta.datesFromFile).toBe(false);
  });

  it("flags duplicates and unknown PDF employees; unknown remain importable via auto-create", async () => {
    employeeFindMany.mockResolvedValue([{ id: 1, employeeCode: "EMP001" }]);
    attendanceFindMany.mockResolvedValue([
      { employeeId: 1, attendanceDate: startOfDay(new Date("2026-07-24T00:00:00")) },
    ]);

    const formDate = startOfDay(new Date("2026-07-24T00:00:00"));
    const preview = await buildAttendanceImportPreview({
      previewId: "p2",
      fileName: "att.pdf",
      fileSize: 50,
      format: "pdf",
      reportType: "PDF_DAILY",
      formAttendanceDate: formDate,
      rows: [
        row({ employeeCode: "EMP001", source: "PDF_DAILY" }),
        row({ employeeCode: "GHOST", source: "PDF_DAILY" }),
      ],
    });

    expect(preview.summary.duplicateRows).toBe(1);
    expect(preview.summary.unknownEmployees).toBe(1);
    expect(preview.rows[0].validationStatus).toBe("duplicate");
    expect(preview.rows[0].importable).toBe(false);
    expect(preview.rows[1].validationStatus).toBe("warning");
    expect(preview.rows[1].importable).toBe(true);
    expect(preview.canConfirm).toBe(true);
  });

  it("Summary preview requires per-row dates and sets datesFromFile", async () => {
    const formDate = startOfDay(new Date("2026-01-01T00:00:00"));
    const july16 = startOfDay(new Date("2026-07-16T00:00:00"));

    const preview = await buildAttendanceImportPreview({
      previewId: "s1",
      fileName: "summary.pdf",
      fileSize: 80,
      format: "pdf",
      reportType: "PDF_SUMMARY",
      formAttendanceDate: formDate,
      rows: [
        row({
          employeeCode: "EMP001",
          attendanceDate: july16,
          source: "PDF_SUMMARY",
        }),
        row({
          employeeCode: "EMP001",
          source: "PDF_SUMMARY",
        }),
      ],
    });

    expect(preview.meta.datesFromFile).toBe(true);
    expect(preview.rows[0].attendanceDate).toBe("2026-07-16");
    expect(preview.rows[1].validationStatus).toBe("error");
    expect(preview.errors.some((e) => e.code === "missing_attendance_date")).toBe(true);
    expect(preview.canConfirm).toBe(true);
  });

  it("allows confirm when PDF has only unknown employees (auto-create)", async () => {
    employeeFindMany.mockResolvedValue([]);
    attendanceFindMany.mockResolvedValue([]);

    const preview = await buildAttendanceImportPreview({
      previewId: "u1",
      fileName: "att.pdf",
      fileSize: 20,
      format: "pdf",
      reportType: "PDF_DAILY",
      formAttendanceDate: startOfDay(new Date("2026-07-24T00:00:00")),
      rows: [row({ employeeCode: "NOPE", source: "PDF_DAILY" })],
    });

    expect(preview.canConfirm).toBe(true);
    expect(preview.summary.unknownEmployees).toBe(1);
    expect(preview.summary.importableRows).toBe(1);
    expect(preview.errors.some((e) => e.code === "all_unknown_employees")).toBe(false);
    expect(
      preview.warnings.some((w) => w.code === "unknown_employee_auto_create")
    ).toBe(true);
  });
});
