import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/session";
import type { AttendanceImportRow } from "@/lib/attendance/import/types";

const employeeFindUnique = vi.fn();
const employeeCreate = vi.fn();
const attendanceRecordFindUnique = vi.fn();
const attendanceRecordCreate = vi.fn();
const attendanceSessionCreate = vi.fn();
const attendanceUploadCreate = vi.fn();
const attendanceUploadUpdate = vi.fn();
const notificationPreferenceCreate = vi.fn();
const writeAuditLog = vi.fn();
const provisionEmployeeLogin = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transaction(...args),
    notificationPreference: {
      create: (...args: unknown[]) => notificationPreferenceCreate(...args),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: { ATTENDANCE_UPLOAD_COMPLETED: "attendance.upload.completed" },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

vi.mock("@/lib/security/request-context", () => ({
  getRequestSecurityContext: async () => ({ ip: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/lib/admin/user-management", () => ({
  UserManagementError: class UserManagementError extends Error {},
  provisionEmployeeLogin: (...args: unknown[]) => provisionEmployeeLogin(...args),
}));

import { importAttendanceRows } from "@/lib/attendance/import/import-records";

const hrActor: SessionUser = {
  id: "hr-1",
  email: "hr@test.local",
  role: "hr",
  employeeId: null,
  employeeName: null,
  sessionVersion: 1,
  authProvider: "local",
};

function row(partial: Partial<AttendanceImportRow> & { employeeCode: string }): AttendanceImportRow {
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
  };
}

function txClient() {
  return {
    employee: {
      findUnique: (...args: unknown[]) => employeeFindUnique(...args),
      create: (...args: unknown[]) => employeeCreate(...args),
    },
    attendanceRecord: {
      findUnique: (...args: unknown[]) => attendanceRecordFindUnique(...args),
      create: (...args: unknown[]) => attendanceRecordCreate(...args),
    },
    attendanceSession: {
      create: (...args: unknown[]) => attendanceSessionCreate(...args),
    },
    attendanceUpload: {
      create: (...args: unknown[]) => attendanceUploadCreate(...args),
      update: (...args: unknown[]) => attendanceUploadUpdate(...args),
    },
  };
}

describe("importAttendanceRows (shared Excel/PDF importer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attendanceUploadCreate.mockResolvedValue({ id: 42 });
    attendanceUploadUpdate.mockResolvedValue({});
    attendanceRecordCreate.mockResolvedValue({ id: 100 });
    attendanceSessionCreate.mockResolvedValue({});
    writeAuditLog.mockResolvedValue(undefined);
    provisionEmployeeLogin.mockResolvedValue({ userId: "user-1" });
    notificationPreferenceCreate.mockResolvedValue({});
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient()));
  });

  it("imports new records for known employees (PDF)", async () => {
    employeeFindUnique.mockResolvedValue({ id: 7, employeeCode: "EMP001" });
    attendanceRecordFindUnique.mockResolvedValue(null);

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "att.pdf",
      attendanceDate: new Date("2026-07-24T00:00:00.000Z"),
      rows: [row({ employeeCode: "EMP001" })],
      source: "pdf",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.rejectedUnknownEmployees).toEqual([]);
    expect(attendanceRecordCreate).toHaveBeenCalledTimes(1);
    expect(employeeCreate).not.toHaveBeenCalled();
    expect(provisionEmployeeLogin).not.toHaveBeenCalled();
  });

  it("rejects unknown employees for PDF without creating or provisioning", async () => {
    employeeFindUnique.mockResolvedValue(null);

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "att.pdf",
      attendanceDate: new Date("2026-07-24T00:00:00.000Z"),
      rows: [row({ employeeCode: "UNKNOWN99" })],
      source: "pdf",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("UNKNOWN99");
    expect(result.error.toLowerCase()).toContain("does not create");
    expect(employeeCreate).not.toHaveBeenCalled();
    expect(provisionEmployeeLogin).not.toHaveBeenCalled();
    expect(attendanceRecordCreate).not.toHaveBeenCalled();
  });

  it("imports known PDF rows and reports unknown codes without creating them", async () => {
    employeeFindUnique.mockImplementation(async ({ where }: { where: { employeeCode: string } }) => {
      if (where.employeeCode === "EMP001") return { id: 7, employeeCode: "EMP001" };
      return null;
    });
    attendanceRecordFindUnique.mockResolvedValue(null);

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "att.pdf",
      attendanceDate: new Date("2026-07-24T00:00:00.000Z"),
      rows: [row({ employeeCode: "EMP001" }), row({ employeeCode: "GHOST1" })],
      source: "pdf",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(1);
    expect(result.rejectedUnknownEmployees).toEqual(["GHOST1"]);
    expect(employeeCreate).not.toHaveBeenCalled();
    expect(provisionEmployeeLogin).not.toHaveBeenCalled();
  });

  it("skips duplicates for the same employee and date", async () => {
    employeeFindUnique.mockResolvedValue({ id: 7, employeeCode: "EMP001" });
    attendanceRecordFindUnique.mockResolvedValue({ id: 99 });

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "att.xlsx",
      attendanceDate: new Date("2026-07-24T00:00:00.000Z"),
      rows: [row({ employeeCode: "EMP001" })],
      source: "excel",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(attendanceRecordCreate).not.toHaveBeenCalled();
  });

  it("Excel auto-creates unknown employees then provisions after commit", async () => {
    employeeFindUnique.mockResolvedValue(null);
    employeeCreate.mockResolvedValue({ id: 15, employeeCode: "NEW001" });

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "att.xlsx",
      attendanceDate: new Date("2026-07-24T00:00:00.000Z"),
      rows: [row({ employeeCode: "NEW001", employeeName: "New Hire" })],
      source: "excel",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(1);
    expect(employeeCreate).toHaveBeenCalled();
    expect(provisionEmployeeLogin).toHaveBeenCalled();
    expect(notificationPreferenceCreate).toHaveBeenCalled();
  });

  it("rolls back when a required DB write throws inside the transaction", async () => {
    employeeFindUnique.mockResolvedValue({ id: 7, employeeCode: "EMP001" });
    attendanceRecordFindUnique.mockResolvedValue(null);
    attendanceRecordCreate.mockRejectedValue(new Error("db down"));

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "att.pdf",
      attendanceDate: new Date("2026-07-24T00:00:00.000Z"),
      rows: [row({ employeeCode: "EMP001" })],
      source: "pdf",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("database error");
    expect(transaction).toHaveBeenCalled();
  });

  it("returns a row-limit error without opening a transaction", async () => {
    const rows = Array.from({ length: 2001 }, (_, i) => row({ employeeCode: `E${i}` }));
    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "big.pdf",
      attendanceDate: new Date("2026-07-24T00:00:00.000Z"),
      rows,
      source: "pdf",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("2000");
    expect(transaction).not.toHaveBeenCalled();
  });
});
