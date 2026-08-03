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
    attendanceDate: partial.attendanceDate,
    source: partial.source ?? "PDF_DAILY",
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

  it("PDF auto-creates unknown employees then provisions after commit", async () => {
    employeeFindUnique.mockResolvedValue(null);
    employeeCreate.mockResolvedValue({ id: 15, employeeCode: "UNKNOWN99" });

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "att.pdf",
      attendanceDate: new Date("2026-07-24T00:00:00.000Z"),
      rows: [row({ employeeCode: "UNKNOWN99", employeeName: "New Hire" })],
      source: "pdf",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(1);
    expect(result.rejectedUnknownEmployees).toEqual([]);
    expect(employeeCreate).toHaveBeenCalled();
    expect(provisionEmployeeLogin).toHaveBeenCalledWith(
      hrActor,
      expect.objectContaining({
        employeeId: 15,
        email: "unknown99@zebl.com",
        mode: "create",
      })
    );
    expect(notificationPreferenceCreate).toHaveBeenCalled();
  });

  it("PDF creates missing employees while importing known ones", async () => {
    employeeFindUnique.mockImplementation(async ({ where }: { where: { employeeCode: string } }) => {
      if (where.employeeCode === "EMP001") return { id: 7, employeeCode: "EMP001" };
      return null;
    });
    employeeCreate.mockResolvedValue({ id: 22, employeeCode: "GHOST1" });
    attendanceRecordFindUnique.mockResolvedValue(null);

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "att.pdf",
      attendanceDate: new Date("2026-07-24T00:00:00.000Z"),
      rows: [row({ employeeCode: "EMP001" }), row({ employeeCode: "GHOST1", employeeName: "Ghost" })],
      source: "pdf",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(2);
    expect(result.rejectedUnknownEmployees).toEqual([]);
    expect(employeeCreate).toHaveBeenCalledTimes(1);
    expect(provisionEmployeeLogin).toHaveBeenCalledTimes(1);
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

  it("Excel rows without attendanceDate use the upload-form date", async () => {
    employeeFindUnique.mockResolvedValue({ id: 7, employeeCode: "EMP001" });
    attendanceRecordFindUnique.mockResolvedValue(null);
    const formDate = new Date("2026-07-24T00:00:00.000Z");

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "att.xlsx",
      attendanceDate: formDate,
      rows: [row({ employeeCode: "EMP001", source: "EXCEL_DAILY" })],
      source: "excel",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(1);
    expect(attendanceRecordFindUnique).toHaveBeenCalledWith({
      where: {
        employeeId_attendanceDate: {
          employeeId: 7,
          attendanceDate: formDate,
        },
      },
    });
    expect(attendanceRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendanceDate: formDate,
        }),
      })
    );
  });

  it("Daily PDF rows without attendanceDate use the upload-form date", async () => {
    employeeFindUnique.mockResolvedValue({ id: 7, employeeCode: "EMP001" });
    attendanceRecordFindUnique.mockResolvedValue(null);
    const formDate = new Date("2026-07-24T00:00:00.000Z");

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "att.pdf",
      attendanceDate: formDate,
      rows: [row({ employeeCode: "EMP001", source: "PDF_DAILY" })],
      source: "pdf",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(attendanceRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendanceDate: formDate,
        }),
      })
    );
  });

  it("uses each row attendanceDate when present (form date ignored)", async () => {
    employeeFindUnique.mockResolvedValue({ id: 7, employeeCode: "EMP-A" });
    attendanceRecordFindUnique.mockResolvedValue(null);

    const formDate = new Date("2026-01-01T00:00:00.000Z");
    const july16 = new Date("2026-07-16T00:00:00.000Z");
    const july17 = new Date("2026-07-17T00:00:00.000Z");

    const result = await importAttendanceRows({
      session: hrActor,
      fileName: "summary-mock.pdf",
      attendanceDate: formDate,
      rows: [
        row({
          employeeCode: "EMP-A",
          employeeName: "Employee A",
          attendanceDate: july16,
          source: "PDF_SUMMARY",
        }),
        row({
          employeeCode: "EMP-A",
          employeeName: "Employee A",
          attendanceDate: july17,
          source: "PDF_SUMMARY",
        }),
      ],
      source: "pdf",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(2);

    const findCalls = attendanceRecordFindUnique.mock.calls.map(
      (c) => c[0].where.employeeId_attendanceDate.attendanceDate
    );
    expect(findCalls).toEqual([july16, july17]);

    const createDates = attendanceRecordCreate.mock.calls.map(
      (c) => c[0].data.attendanceDate
    );
    expect(createDates).toEqual([july16, july17]);
    expect(createDates).not.toContain(formDate);
  });
});
