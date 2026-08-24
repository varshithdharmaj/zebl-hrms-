import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyApprovedRegularization,
  deriveAttendanceForEmployeeDate,
} from "@/lib/integrations/biometric-attendance-derivation";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    biometricPunch: { findMany: vi.fn() },
    attendanceRecord: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    attendanceSession: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    attendanceRegularizationRequest: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(prisma)),
    $executeRaw: vi.fn().mockResolvedValue(1),
  },
}));

const employeeId = 42;
const attendanceDate = new Date("2026-08-20T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(prisma));
  vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as any);
  vi.mocked(prisma.attendanceSession.createMany).mockResolvedValue({ count: 0 } as any);
  vi.mocked(prisma.attendanceSession.deleteMany).mockResolvedValue({ count: 0 } as any);
});

describe("approved regularisation overrides re-derivation from raw punches", () => {
  it("a stray late-arriving punch does not disturb a full-day (attendance_missing) approved correction", async () => {
    // A device sync brings in a single stray punch for a day HR already
    // fully overrode (e.g. the employee was on an off-site visit with zero
    // real attendance). The approved correction must still win outright.
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([
      { id: 1, punchedAt: new Date("2026-08-20T12:30:00.000Z") }, // 18:00 IST, spurious
    ] as any);

    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({
      id: 99,
      remarks: "HR Regularised",
      activeRegularizationId: 501,
    } as any);

    vi.mocked(prisma.attendanceRegularizationRequest.findUnique).mockResolvedValue({
      status: "approved",
      requestType: "attendance_missing",
      requestedCheckIn: "09:00",
      requestedCheckOut: "18:00",
    } as any);

    await deriveAttendanceForEmployeeDate(employeeId, attendanceDate);

    expect(prisma.attendanceSession.deleteMany).toHaveBeenLastCalledWith({
      where: { attendanceId: 99 },
    });
    expect(prisma.attendanceSession.createMany).toHaveBeenLastCalledWith({
      data: [{ attendanceId: 99, checkIn: "09:00", checkOut: "18:00", workedMinutes: 540 }],
    });
    expect(prisma.attendanceRecord.update).toHaveBeenLastCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        checkIn: "09:00",
        checkOut: "18:00",
        remarks: "HR Regularised",
      }),
    });
  });

  it("missing_check_in overlay only fixes the earliest session's checkIn — it does not reinterpret a mispaired punch as a checkout", async () => {
    // Documents a deliberate scoping boundary: missing_check_in assumes a
    // clean zero-punch day. If a stray punch got paired as an open "check-in"
    // by the naive chronological algorithm, the boundary overlay still only
    // overrides checkIn, leaving checkOut null — this exact ambiguity is why
    // submission-time validation (isRequestTypeConsistentWithSessions) steers
    // employees toward attendance_missing/device_failure instead when the
    // current punch shape doesn't cleanly match their claim.
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([
      { id: 1, punchedAt: new Date("2026-08-20T12:30:00.000Z") }, // 18:00 IST
    ] as any);
    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({
      id: 99,
      remarks: "HR Regularised",
      activeRegularizationId: 501,
    } as any);
    vi.mocked(prisma.attendanceRegularizationRequest.findUnique).mockResolvedValue({
      status: "approved",
      requestType: "missing_check_in",
      requestedCheckIn: "09:00",
      requestedCheckOut: null,
    } as any);

    await deriveAttendanceForEmployeeDate(employeeId, attendanceDate);

    expect(prisma.attendanceSession.createMany).toHaveBeenLastCalledWith({
      data: [{ attendanceId: 99, checkIn: "09:00", checkOut: null, workedMinutes: 0 }],
    });
  });

  it("a zero-punch day with an approved attendance_missing correction is not deleted and gets the synthetic session", async () => {
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({
      id: 77,
      remarks: "HR Regularised",
      activeRegularizationId: 900,
    } as any);
    vi.mocked(prisma.attendanceRegularizationRequest.findUnique).mockResolvedValue({
      status: "approved",
      requestType: "attendance_missing",
      requestedCheckIn: "09:30",
      requestedCheckOut: "18:30",
    } as any);

    await deriveAttendanceForEmployeeDate(employeeId, attendanceDate);

    expect(prisma.attendanceRecord.delete).not.toHaveBeenCalled();
    expect(prisma.attendanceSession.createMany).toHaveBeenCalledWith({
      data: [{ attendanceId: 77, checkIn: "09:30", checkOut: "18:30", workedMinutes: 540 }],
    });
    expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: expect.objectContaining({ checkIn: "09:30", checkOut: "18:30", remarks: "HR Regularised" }),
    });
  });

  it("a zero-punch day with no active correction is still deleted (unchanged legacy behaviour)", async () => {
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({
      id: 55,
      remarks: "Biometric Device Ingestion",
      activeRegularizationId: null,
    } as any);

    await deriveAttendanceForEmployeeDate(employeeId, attendanceDate);

    expect(prisma.attendanceSession.deleteMany).toHaveBeenCalledWith({ where: { attendanceId: 55 } });
    expect(prisma.attendanceRecord.delete).toHaveBeenCalledWith({ where: { id: 55 } });
  });
});

describe("applyApprovedRegularization", () => {
  it("points the record at the request and re-runs derivation", async () => {
    vi.mocked(prisma.attendanceRecord.upsert).mockResolvedValue({ id: 88 } as any);
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({
      id: 88,
      remarks: "HR Regularised",
      activeRegularizationId: 321,
    } as any);
    vi.mocked(prisma.attendanceRegularizationRequest.findUnique).mockResolvedValue({
      status: "approved",
      requestType: "device_failure",
      requestedCheckIn: "09:00",
      requestedCheckOut: "17:00",
    } as any);

    await applyApprovedRegularization(prisma as any, {
      id: 321,
      employeeId,
      attendanceDate,
    });

    expect(prisma.attendanceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ activeRegularizationId: 321 }),
      })
    );
    expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
      where: { id: 88 },
      data: expect.objectContaining({ checkIn: "09:00", checkOut: "17:00" }),
    });
  });
});
