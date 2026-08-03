import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/session";
import type { AttendanceImportRow } from "@/lib/attendance/import/types";
import { IMPORT_CHUNK_SIZE } from "@/lib/attendance/import/import-job-payload";

const attendanceImportJobCreate = vi.fn();
const attendanceImportJobFindUnique = vi.fn();
const attendanceImportJobUpdateMany = vi.fn();
const attendanceImportJobUpdate = vi.fn();
const attendanceImportJobFindMany = vi.fn();
const attendanceUploadCreate = vi.fn();
const attendanceUploadUpdate = vi.fn();
const transaction = vi.fn();
const writeAuditLog = vi.fn();
const provisionEmployeeLogin = vi.fn();
const notificationPreferenceCreate = vi.fn();
const getRequestSecurityContext = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attendanceImportJob: {
      create: (...args: unknown[]) => attendanceImportJobCreate(...args),
      findUnique: (...args: unknown[]) => attendanceImportJobFindUnique(...args),
      updateMany: (...args: unknown[]) => attendanceImportJobUpdateMany(...args),
      update: (...args: unknown[]) => attendanceImportJobUpdate(...args),
      findMany: (...args: unknown[]) => attendanceImportJobFindMany(...args),
    },
    attendanceUpload: {
      create: (...args: unknown[]) => attendanceUploadCreate(...args),
      update: (...args: unknown[]) => attendanceUploadUpdate(...args),
    },
    notificationPreference: {
      create: (...args: unknown[]) => notificationPreferenceCreate(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
    $queryRaw: vi.fn(async () => [{ exists: true }]),
    $executeRawUnsafe: vi.fn(async () => 0),
  },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: { ATTENDANCE_UPLOAD_COMPLETED: "attendance.upload.completed" },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

vi.mock("@/lib/security/request-context", () => ({
  getRequestSecurityContext: (...args: unknown[]) => getRequestSecurityContext(...args),
}));

vi.mock("@/lib/admin/user-management", () => ({
  UserManagementError: class UserManagementError extends Error {},
  provisionEmployeeLogin: (...args: unknown[]) => provisionEmployeeLogin(...args),
}));

vi.mock("@/lib/attendance/import/import-batch", () => ({
  importAttendanceRowBatch: vi.fn(async () => ({
    imported: 1,
    skipped: 0,
    newEmployees: [],
  })),
}));

import { compressPayload } from "@/lib/attendance/import/import-job-payload";
import {
  createAttendanceImportJob,
  processAttendanceImportJob,
  resumeAttendanceImportJob,
} from "@/lib/attendance/import/import-job";
import { importAttendanceRowBatch } from "@/lib/attendance/import/import-batch";

const hrActor: SessionUser = {
  id: "hr-1",
  email: "hr@test.local",
  role: "hr",
  employeeId: null,
  employeeName: null,
  sessionVersion: 1,
  authProvider: "local",
};

function row(code: string): AttendanceImportRow {
  return {
    employeeCode: code,
    employeeName: code,
    shift: "GS",
    inTime: "09:00",
    outTime: "18:00",
    workDuration: "09:00",
    ot: "0",
    status: "Present",
    remarks: "",
    source: "PDF_DAILY",
  };
}

describe("attendance import jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestSecurityContext.mockResolvedValue({ ip: "127.0.0.1", userAgent: "test" });
    provisionEmployeeLogin.mockResolvedValue({ userId: "u1" });
    notificationPreferenceCreate.mockResolvedValue({});
    writeAuditLog.mockResolvedValue(undefined);
    attendanceUploadCreate.mockResolvedValue({ id: 99 });
    attendanceUploadUpdate.mockResolvedValue({});
    attendanceImportJobUpdate.mockResolvedValue({});
    (importAttendanceRowBatch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      imported: 1,
      skipped: 0,
      newEmployees: [],
    });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
  });

  it("creates a job with compressed payload", async () => {
    attendanceImportJobCreate.mockResolvedValue({ id: "job-1" });
    const rows = [row("A1"), row("A2")];
    const result = await createAttendanceImportJob({
      session: hrActor,
      fileName: "att.pdf",
      source: "pdf",
      reportType: "PDF_DAILY",
      formAttendanceDate: new Date("2026-07-29T00:00:00.000Z"),
      rows,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobId).toBe("job-1");
    expect(attendanceImportJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: "hr-1",
          status: "UPLOADED",
          totalRows: 2,
          nextRowIndex: 0,
          payloadCompressed: expect.any(Buffer),
        }),
      })
    );
  });

  it("rejects concurrent processing when status is PROCESSING", async () => {
    attendanceImportJobFindUnique.mockResolvedValue({
      id: "job-1",
      createdByUserId: "hr-1",
      status: "PROCESSING",
      importedCount: 0,
      skippedCount: 0,
      employeesCreated: 0,
      usersCreated: 0,
      nextRowIndex: 0,
      totalRows: 2,
      payloadCompressed: compressPayload([row("A1")]),
      formAttendanceDate: new Date("2026-07-29"),
      fileName: "a.pdf",
      source: "pdf",
      startedAt: new Date(),
      warningsCount: 0,
    });

    const result = await processAttendanceImportJob("job-1", hrActor);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Job already processing");
    expect(attendanceImportJobUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects non-owners", async () => {
    attendanceImportJobFindUnique.mockResolvedValue({
      id: "job-1",
      createdByUserId: "other",
      status: "FAILED",
      importedCount: 3,
      skippedCount: 1,
      employeesCreated: 0,
      usersCreated: 0,
      nextRowIndex: 5,
      totalRows: 10,
      payloadCompressed: compressPayload([row("A1")]),
      formAttendanceDate: new Date("2026-07-29"),
      fileName: "a.pdf",
      source: "pdf",
      startedAt: null,
      warningsCount: 0,
    });

    const result = await processAttendanceImportJob("job-1", hrActor);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/do not have access/i);
  });

  it("processes chunks and advances nextRowIndex to completion", async () => {
    const rows = Array.from({ length: IMPORT_CHUNK_SIZE + 2 }, (_, i) => row(`E${i}`));
    attendanceImportJobFindUnique.mockResolvedValue({
      id: "job-1",
      createdByUserId: "hr-1",
      status: "UPLOADED",
      importedCount: 0,
      skippedCount: 0,
      employeesCreated: 0,
      usersCreated: 0,
      nextRowIndex: 0,
      totalRows: rows.length,
      payloadCompressed: compressPayload(rows),
      formAttendanceDate: new Date("2026-07-29"),
      fileName: "a.pdf",
      source: "pdf",
      startedAt: null,
      warningsCount: 0,
    });
    attendanceImportJobUpdateMany.mockResolvedValue({ count: 1 });
    (importAttendanceRowBatch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (_tx: unknown, params: { rows: AttendanceImportRow[] }) => ({
        imported: params.rows.length,
        skipped: 0,
        newEmployees: [],
      })
    );

    const result = await processAttendanceImportJob("job-1", hrActor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("COMPLETED");
    expect(result.nextRowIndex).toBe(rows.length);
    expect(result.imported).toBe(rows.length);
    // Two chunk transactions for 17 rows
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(attendanceImportJobUpdate).toHaveBeenCalled();
  });

  it("resume continues from nextRowIndex via same processor", async () => {
    const rows = [row("A1"), row("A2"), row("A3")];
    attendanceImportJobFindUnique.mockResolvedValue({
      id: "job-1",
      createdByUserId: "hr-1",
      status: "FAILED",
      importedCount: 1,
      skippedCount: 0,
      employeesCreated: 0,
      usersCreated: 0,
      nextRowIndex: 1,
      totalRows: 3,
      payloadCompressed: compressPayload(rows),
      formAttendanceDate: new Date("2026-07-29"),
      fileName: "a.pdf",
      source: "pdf",
      startedAt: new Date(),
      warningsCount: 0,
    });
    attendanceImportJobUpdateMany.mockResolvedValue({ count: 1 });
    (importAttendanceRowBatch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (_tx: unknown, params: { rows: AttendanceImportRow[] }) => ({
        imported: params.rows.length,
        skipped: 0,
        newEmployees: [],
      })
    );

    const result = await resumeAttendanceImportJob("job-1", hrActor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(1 + 2);
    expect(result.nextRowIndex).toBe(3);
    expect(importAttendanceRowBatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        rows: [rows[1], rows[2]],
      })
    );
  });

  it("marks FAILED and keeps progress when a chunk throws", async () => {
    const rows = [row("A1"), row("A2")];
    attendanceImportJobFindUnique.mockResolvedValue({
      id: "job-1",
      createdByUserId: "hr-1",
      status: "UPLOADED",
      importedCount: 0,
      skippedCount: 0,
      employeesCreated: 0,
      usersCreated: 0,
      nextRowIndex: 0,
      totalRows: 2,
      payloadCompressed: compressPayload(rows),
      formAttendanceDate: new Date("2026-07-29"),
      fileName: "a.pdf",
      source: "pdf",
      startedAt: null,
      warningsCount: 0,
    });
    attendanceImportJobUpdateMany.mockResolvedValue({ count: 1 });
    transaction.mockRejectedValue(Object.assign(new Error("boom"), { code: "P2028" }));

    const result = await processAttendanceImportJob("job-1", hrActor);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/Continue Import/i);
    expect(attendanceImportJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });
});
