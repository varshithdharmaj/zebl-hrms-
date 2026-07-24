import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  checkInEmployeeSession,
  checkOutEmployeeSession,
  ensureLegacySessionForRecord,
  getDaySessionsForEmployee,
  recalculateDailyAttendanceTotals,
} from "@/lib/attendance/attendance-sessions";
import {
  sessionDurationMinutes,
  totalWorkedMinutesFromSessions,
} from "@/lib/attendance/session-duration";
import { computeEmployeePeriodMetrics } from "@/lib/payroll/payroll-calculations";
import type { PayrollSettingsSnapshot } from "@/lib/payroll/payroll-types";

vi.mock("@/lib/prisma", () => {
  const attendanceRecord = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const attendanceSession = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  };
  return {
    prisma: {
      attendanceRecord,
      attendanceSession,
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          attendanceRecord,
          attendanceSession,
        })
      ),
    },
  };
});

const baseSettings: PayrollSettingsSnapshot = {
  payrollStartDay: 1,
  requiredWorkMinutes: 480,
  breakMinutes: 0,
  requiredOfficeMinutes: 480,
  graceMinutes: 0,
  otThresholdMinutes: 0,
  halfDayThresholdMinutes: 240,
  shiftRules: {},
};

describe("multiple attendance periods — duration", () => {
  it("sums Period 1 09:00→12:00 + Period 2 13:00→18:00 = 480 minutes (8h)", () => {
    expect(sessionDurationMinutes("09:00", "12:00")).toBe(180);
    expect(sessionDurationMinutes("13:00", "18:00")).toBe(300);
    const total = totalWorkedMinutesFromSessions([
      { checkIn: "09:00", checkOut: "12:00", workedMinutes: 180 },
      { checkIn: "13:00", checkOut: "18:00", workedMinutes: 300 },
    ]);
    expect(total).toBe(480);
  });

  it("sums legacy-style multi period example to 501 minutes", () => {
    expect(sessionDurationMinutes("09:04", "12:30")).toBe(206);
    expect(sessionDurationMinutes("13:30", "18:25")).toBe(295);
    const total = totalWorkedMinutesFromSessions([
      { checkIn: "09:04", checkOut: "12:30", workedMinutes: 206 },
      { checkIn: "13:30", checkOut: "18:25", workedMinutes: 295 },
    ]);
    expect(total).toBe(501);
  });

  it("single period still works (09:04 → 18:25)", () => {
    expect(sessionDurationMinutes("09:04", "18:25")).toBe(561);
  });
});

describe("payroll compatibility with session totals", () => {
  it("uses daily workedMinutes for single-period attendance", () => {
    const metrics = computeEmployeePeriodMetrics(
      [
        {
          checkIn: "09:04",
          checkOut: "18:25",
          workDuration: "08:21",
          workedMinutes: 501,
          overtimeMinutes: 21,
          status: "Present",
          remarks: null,
        },
      ],
      baseSettings,
      "Morning Shift",
      0
    );
    expect(metrics.actualMinutes).toBe(501);
    expect(metrics.otMinutes).toBe(21);
  });

  it("uses summed daily workedMinutes for multi-period attendance", () => {
    const metrics = computeEmployeePeriodMetrics(
      [
        {
          checkIn: "09:00",
          checkOut: "18:00",
          workDuration: "08:00",
          workedMinutes: 480,
          overtimeMinutes: 0,
          status: "Present",
          remarks: "09:00–12:00 + 13:00–18:00",
        },
      ],
      baseSettings,
      "Morning Shift",
      0
    );
    expect(metrics.actualMinutes).toBe(480);
    expect(metrics.otMinutes).toBe(0);
  });

  it("computes overtime from total actual when multi-period exceeds required", () => {
    const metrics = computeEmployeePeriodMetrics(
      [
        {
          checkIn: "09:04",
          checkOut: "18:25",
          workDuration: "08:21",
          workedMinutes: 501,
          overtimeMinutes: 0,
          status: "Present",
          remarks: null,
        },
      ],
      baseSettings,
      "Morning Shift",
      0
    );
    expect(metrics.actualMinutes).toBe(501);
    expect(metrics.otMinutes).toBe(21);
  });
});

describe("checkInEmployeeSession / checkOutEmployeeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates first open period on check-in", async () => {
    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.attendanceRecord.create).mockResolvedValue({ id: 10 } as never);
    vi.mocked(prisma.attendanceSession.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.attendanceSession.create).mockResolvedValue({
      id: 100,
      checkIn: "09:00",
      checkOut: null,
      workedMinutes: 0,
    } as never);
    vi.mocked(prisma.attendanceSession.findMany).mockResolvedValue([
      { id: 100, checkIn: "09:00", checkOut: null, workedMinutes: 0 },
    ] as never);
    vi.mocked(prisma.attendanceRecord.update).mockResolvedValue({} as never);

    const asOf = new Date(2026, 6, 23, 9, 0, 0);
    const result = await checkInEmployeeSession(7, asOf);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attendanceId).toBe(10);
      expect(result.sessionId).toBe(100);
    }
    expect(prisma.attendanceSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendanceId: 10,
          checkOut: null,
          workedMinutes: 0,
        }),
      })
    );
  });

  it("rejects duplicate active check-in", async () => {
    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({ id: 10 } as never);
    vi.mocked(prisma.attendanceSession.findFirst).mockResolvedValue({ id: 100 } as never);

    const result = await checkInEmployeeSession(7, new Date(2026, 6, 23, 10, 0, 0));

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "ALREADY_CHECKED_IN",
      })
    );
    expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
  });

  it("closes open period on check-out", async () => {
    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({ id: 10 } as never);
    vi.mocked(prisma.attendanceSession.findFirst).mockResolvedValue({
      id: 100,
      checkIn: "09:00",
      checkOut: null,
      workedMinutes: 0,
    } as never);
    vi.mocked(prisma.attendanceSession.update).mockResolvedValue({} as never);
    vi.mocked(prisma.attendanceSession.findMany).mockResolvedValue([
      {
        id: 100,
        checkIn: "09:00",
        checkOut: "12:00",
        workedMinutes: 180,
      },
    ] as never);
    vi.mocked(prisma.attendanceRecord.update).mockResolvedValue({} as never);

    const asOf = new Date(2026, 6, 23, 12, 0, 0);
    const result = await checkOutEmployeeSession(7, asOf);

    expect(result.ok).toBe(true);
    expect(prisma.attendanceSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: { checkOut: "12:00", workedMinutes: 180 },
      })
    );
  });

  it("rejects check-out without active check-in", async () => {
    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({ id: 10 } as never);
    vi.mocked(prisma.attendanceSession.findFirst).mockResolvedValue(null as never);

    const result = await checkOutEmployeeSession(7, new Date(2026, 6, 23, 12, 0, 0));

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "NO_OPEN_SESSION",
      })
    );
  });

  it("supports second check-in after first check-out", async () => {
    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({ id: 10 } as never);
    vi.mocked(prisma.attendanceSession.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.attendanceSession.create).mockResolvedValue({
      id: 101,
      checkIn: "13:00",
      checkOut: null,
      workedMinutes: 0,
    } as never);
    vi.mocked(prisma.attendanceSession.findMany).mockResolvedValue([
      { id: 100, checkIn: "09:00", checkOut: "12:00", workedMinutes: 180 },
      { id: 101, checkIn: "13:00", checkOut: null, workedMinutes: 0 },
    ] as never);
    vi.mocked(prisma.attendanceRecord.update).mockResolvedValue({} as never);

    const result = await checkInEmployeeSession(7, new Date(2026, 6, 23, 13, 0, 0));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sessionId).toBe(101);
  });

  it("recalculates daily total from multiple closed periods", async () => {
    vi.mocked(prisma.attendanceSession.findMany).mockResolvedValue([
      { id: 100, checkIn: "09:00", checkOut: "12:00", workedMinutes: 180 },
      { id: 101, checkIn: "13:00", checkOut: "18:00", workedMinutes: 300 },
    ] as never);
    vi.mocked(prisma.attendanceRecord.update).mockResolvedValue({} as never);

    await recalculateDailyAttendanceTotals(10);

    expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        checkIn: "09:00",
        checkOut: "18:00",
        workedMinutes: 480,
        workDuration: "08:00",
        status: "Present",
      },
    });
  });
});

describe("legacy / import compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ensureLegacySessionForRecord creates one session when none exist", async () => {
    vi.mocked(prisma.attendanceSession.count).mockResolvedValue(0);
    vi.mocked(prisma.attendanceSession.create).mockResolvedValue({} as never);

    await ensureLegacySessionForRecord(55, {
      checkIn: "09:04",
      checkOut: "18:25",
      workedMinutes: 561,
    });

    expect(prisma.attendanceSession.create).toHaveBeenCalledWith({
      data: {
        attendanceId: 55,
        checkIn: "09:04",
        checkOut: "18:25",
        workedMinutes: 561,
      },
    });
  });

  it("ensureLegacySessionForRecord is idempotent when sessions exist", async () => {
    vi.mocked(prisma.attendanceSession.count).mockResolvedValue(1);

    await ensureLegacySessionForRecord(55, {
      checkIn: "09:04",
      checkOut: "18:25",
      workedMinutes: 561,
    });

    expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
  });

  it("getDaySessionsForEmployee falls back to legacy daily fields", async () => {
    vi.mocked(prisma.attendanceRecord.findFirst).mockResolvedValue({
      id: 55,
      checkIn: "09:04",
      checkOut: "18:25",
      workedMinutes: 561,
      status: "Present",
      sessions: [],
    } as never);

    const result = await getDaySessionsForEmployee(7, new Date(2026, 6, 23));

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({
      checkIn: "09:04",
      checkOut: "18:25",
      workedMinutes: 561,
      isOpen: false,
    });
    expect(result.totalWorkedMinutes).toBe(561);
  });
});
