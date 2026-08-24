import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const writeAuditLog = vi.fn(async () => undefined);
const applyApprovedRegularization = vi.fn(async () => undefined);
const queueRegularizationSubmittedAlert = vi.fn(async () => undefined);
const queueRegularizationDecisionNotice = vi.fn(async () => undefined);

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    ATTENDANCE_REGULARIZATION: "attendance.regularization",
    ATTENDANCE_REGULARIZATION_CANCELLED: "attendance.regularization.cancelled",
    ATTENDANCE_REGULARIZATION_REJECTED: "attendance.regularization.rejected",
    ATTENDANCE_APPROVED: "attendance.approved",
  },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

vi.mock("@/lib/attendance/regularization/notifications", () => ({
  queueRegularizationSubmittedAlert: (...args: unknown[]) => queueRegularizationSubmittedAlert(...args),
  queueRegularizationDecisionNotice: (...args: unknown[]) => queueRegularizationDecisionNotice(...args),
}));

vi.mock("@/lib/integrations/biometric-attendance-derivation", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/integrations/biometric-attendance-derivation")
  >();
  return {
    ...actual,
    applyApprovedRegularization: (...args: unknown[]) => applyApprovedRegularization(...args),
  };
});

const attendanceRegularizationRequestCreate = vi.fn();
const attendanceRegularizationRequestUpdateMany = vi.fn();
const attendanceRegularizationRequestUpdate = vi.fn();
const attendanceRegularizationRequestFindUnique = vi.fn();
const attendanceRecordFindUnique = vi.fn(async () => null);
const employeeFindUnique = vi.fn(async () => ({ name: "Jane Doe" }));
const holidayFindUnique = vi.fn(async () => null);
const attendanceDateOverrideFindUnique = vi.fn(async () => null);
const leaveRequestFindFirst = vi.fn(async () => null);
const payrollSettingsFindUnique = vi.fn(async () => ({ regularizationWindowDays: 7 }));

function makeTx() {
  return {
    attendanceRegularizationRequest: {
      create: (...args: unknown[]) => attendanceRegularizationRequestCreate(...args),
      updateMany: (...args: unknown[]) => attendanceRegularizationRequestUpdateMany(...args),
      update: (...args: unknown[]) => attendanceRegularizationRequestUpdate(...args),
    },
  };
}

const transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(makeTx()));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attendanceRegularizationRequest: {
      create: (...args: unknown[]) => attendanceRegularizationRequestCreate(...args),
      findUnique: (...args: unknown[]) => attendanceRegularizationRequestFindUnique(...args),
      updateMany: (...args: unknown[]) => attendanceRegularizationRequestUpdateMany(...args),
    },
    attendanceRecord: {
      findUnique: (...args: unknown[]) => attendanceRecordFindUnique(...args),
    },
    employee: {
      findUnique: (...args: unknown[]) => employeeFindUnique(...args),
    },
    holiday: {
      findUnique: (...args: unknown[]) => holidayFindUnique(...args),
    },
    attendanceDateOverride: {
      findUnique: (...args: unknown[]) => attendanceDateOverrideFindUnique(...args),
    },
    leaveRequest: {
      findFirst: (...args: unknown[]) => leaveRequestFindFirst(...args),
    },
    payrollSettings: {
      findUnique: (...args: unknown[]) => payrollSettingsFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => transaction(args[0] as (tx: unknown) => unknown),
  },
}));

import {
  approveRegularizationRequest,
  cancelRegularizationRequest,
  rejectRegularizationRequest,
  RegularizationError,
  submitRegularizationRequest,
  type RegularizationActor,
} from "@/lib/attendance/regularization/regularization-service";

const employeeActor: RegularizationActor = {
  userId: "user-1",
  email: "employee@example.com",
  role: "employee",
  employeeId: 42,
};

const hrActor: RegularizationActor = {
  userId: "user-2",
  email: "hr@example.com",
  role: "hr",
  employeeId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  attendanceRecordFindUnique.mockResolvedValue(null);
  employeeFindUnique.mockResolvedValue({ name: "Jane Doe" });
  holidayFindUnique.mockResolvedValue(null);
  attendanceDateOverrideFindUnique.mockResolvedValue(null);
  leaveRequestFindFirst.mockResolvedValue(null);
  payrollSettingsFindUnique.mockResolvedValue({ regularizationWindowDays: 7 });
  transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx()));
});

describe("submitRegularizationRequest", () => {
  it("creates a pending request and queues an HR alert after commit", async () => {
    attendanceRegularizationRequestCreate.mockResolvedValue({ id: 501 });

    const result = await submitRegularizationRequest({
      actor: employeeActor,
      attendanceDate: new Date(2026, 7, 20),
      requestType: "missing_check_in",
      requestedCheckIn: "09:00",
      requestedCheckOut: null,
      checkOutNextDay: false,
      reason: "Forgot to swipe in this morning.",
    });

    expect(result.requestId).toBe(501);
    expect(attendanceRegularizationRequestCreate).toHaveBeenCalledTimes(1);
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    expect(queueRegularizationSubmittedAlert).toHaveBeenCalledTimes(1);
  });

  it("rejects submission when the current session shape contradicts the claimed type", async () => {
    attendanceRecordFindUnique.mockResolvedValue({
      checkIn: "09:00",
      checkOut: "17:00",
      workedMinutes: 480,
      status: "Present",
      remarks: "Biometric Device Ingestion",
      sessions: [{ checkIn: "09:00", checkOut: "17:00" }],
    });

    await expect(
      submitRegularizationRequest({
        actor: employeeActor,
        attendanceDate: new Date(2026, 7, 20),
        requestType: "missing_check_in",
        requestedCheckIn: "09:00",
        requestedCheckOut: null,
        checkOutNextDay: false,
        reason: "My check-in time is wrong today.",
      })
    ).rejects.toThrow(RegularizationError);

    expect(attendanceRegularizationRequestCreate).not.toHaveBeenCalled();
  });

  it("surfaces a duplicate-pending-request DB conflict as a friendly error", async () => {
    attendanceRegularizationRequestCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    await expect(
      submitRegularizationRequest({
        actor: employeeActor,
        attendanceDate: new Date(2026, 7, 20),
        requestType: "attendance_missing",
        requestedCheckIn: "09:00",
        requestedCheckOut: "18:00",
        checkOutNextDay: false,
        reason: "Was on field visit, no device access.",
      })
    ).rejects.toThrow(/already have a pending regularisation request/i);
  });

  it("rejects a null employeeId actor", async () => {
    await expect(
      submitRegularizationRequest({
        actor: { ...employeeActor, employeeId: null },
        attendanceDate: new Date(2026, 7, 20),
        requestType: "attendance_missing",
        requestedCheckIn: "09:00",
        requestedCheckOut: "18:00",
        checkOutNextDay: false,
        reason: "No employee profile linked test.",
      })
    ).rejects.toThrow(RegularizationError);
  });
});

describe("approveRegularizationRequest", () => {
  const pendingRequest = {
    id: 501,
    employeeId: 42,
    attendanceDate: new Date(2026, 7, 20),
    status: "pending",
    version: 0,
    requestType: "missing_check_in",
    employee: { id: 42, name: "Jane Doe", email: "jane@example.com" },
  };

  it("applies the correction and marks approved atomically; notifies only after commit", async () => {
    attendanceRegularizationRequestFindUnique.mockResolvedValue(pendingRequest);
    attendanceRegularizationRequestUpdateMany.mockResolvedValue({ count: 1 });

    await approveRegularizationRequest({
      actor: hrActor,
      requestId: 501,
      expectedVersion: 0,
    });

    expect(applyApprovedRegularization).toHaveBeenCalledTimes(1);
    expect(attendanceRegularizationRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "approved" }),
      })
    );
    // Two audit rows: the review decision and the derived attendance change.
    expect(writeAuditLog).toHaveBeenCalledTimes(2);
    expect(queueRegularizationDecisionNotice).toHaveBeenCalledWith(
      expect.objectContaining({ approved: true })
    );
  });

  it("rejects a non-HR actor before touching the transaction", async () => {
    await expect(
      approveRegularizationRequest({
        actor: employeeActor,
        requestId: 501,
        expectedVersion: 0,
      })
    ).rejects.toThrow(RegularizationError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("throws and applies no correction when another admin already actioned it (version race)", async () => {
    attendanceRegularizationRequestFindUnique.mockResolvedValue(pendingRequest);
    attendanceRegularizationRequestUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      approveRegularizationRequest({ actor: hrActor, requestId: 501, expectedVersion: 0 })
    ).rejects.toThrow(RegularizationError);

    expect(applyApprovedRegularization).not.toHaveBeenCalled();
    expect(queueRegularizationDecisionNotice).not.toHaveBeenCalled();
  });

  it("throws if the request is no longer pending", async () => {
    attendanceRegularizationRequestFindUnique.mockResolvedValue({
      ...pendingRequest,
      status: "approved",
    });

    await expect(
      approveRegularizationRequest({ actor: hrActor, requestId: 501, expectedVersion: 0 })
    ).rejects.toThrow(RegularizationError);
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("rejectRegularizationRequest", () => {
  const pendingRequest = {
    id: 501,
    employeeId: 42,
    attendanceDate: new Date(2026, 7, 20),
    status: "pending",
    version: 0,
    employee: { id: 42, email: "jane@example.com" },
  };

  it("requires a rejection comment of at least 10 characters", async () => {
    attendanceRegularizationRequestFindUnique.mockResolvedValue(pendingRequest);
    await expect(
      rejectRegularizationRequest({
        actor: hrActor,
        requestId: 501,
        expectedVersion: 0,
        reviewComment: "too short",
      })
    ).rejects.toThrow(RegularizationError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects the request and notifies the employee after commit", async () => {
    attendanceRegularizationRequestFindUnique.mockResolvedValue(pendingRequest);
    attendanceRegularizationRequestUpdateMany.mockResolvedValue({ count: 1 });

    await rejectRegularizationRequest({
      actor: hrActor,
      requestId: 501,
      expectedVersion: 0,
      reviewComment: "Punch data shows a normal full day already.",
    });

    expect(attendanceRegularizationRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "rejected" }) })
    );
    expect(queueRegularizationDecisionNotice).toHaveBeenCalledWith(
      expect.objectContaining({ approved: false })
    );
  });
});

describe("cancelRegularizationRequest", () => {
  it("cancels only when the caller owns a still-pending request", async () => {
    attendanceRegularizationRequestUpdateMany.mockResolvedValue({ count: 1 });
    await cancelRegularizationRequest({ actor: employeeActor, requestId: 501 });
    expect(attendanceRegularizationRequestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 501, employeeId: 42, status: "pending" },
      })
    );
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("throws if the request was already actioned", async () => {
    attendanceRegularizationRequestUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      cancelRegularizationRequest({ actor: employeeActor, requestId: 501 })
    ).rejects.toThrow(RegularizationError);
  });
});
