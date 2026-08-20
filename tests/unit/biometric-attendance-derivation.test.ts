import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getISTDateParts,
  deriveAttendanceForEmployeeDate,
} from "@/lib/integrations/biometric-attendance-derivation";
import { ingestBiometricPunches } from "@/lib/integrations/biometric-ingestion";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findMany: vi.fn(),
    },
    biometricPunch: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    attendanceRecord: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    attendanceSession: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(prisma)),
    $executeRaw: vi.fn().mockResolvedValue(1),
  },
}));

describe("Biometric IST Timezone Helpers", () => {
  it("converts 18:45:00 UTC on Aug 17 to 00:15:00 IST on Aug 18", () => {
    // 2026-08-17T18:45:00.000Z in UTC is 2026-08-18 00:15:00 IST
    const utcDate = new Date("2026-08-17T18:45:00.000Z");
    const parts = getISTDateParts(utcDate);

    expect(parts.dateString).toBe("2026-08-18");
    expect(parts.timeString).toBe("00:15");
    expect(parts.attendanceDate.getFullYear()).toBe(2026);
    expect(parts.attendanceDate.getMonth()).toBe(7); // August (0-indexed)
    expect(parts.attendanceDate.getDate()).toBe(18);
  });

  it("converts 14:36:43 UTC on Aug 17 to 20:06:43 IST on Aug 17", () => {
    // 2026-08-17T14:36:43.000Z in UTC is 2026-08-17 20:06:43 IST
    const utcDate = new Date("2026-08-17T14:36:43.000Z");
    const parts = getISTDateParts(utcDate);

    expect(parts.dateString).toBe("2026-08-17");
    expect(parts.timeString).toBe("20:06");
  });

  it("handles month boundary correctly (July 31 18:45 UTC = Aug 1 00:15 IST)", () => {
    const utcDate = new Date("2026-07-31T18:45:00.000Z");
    const parts = getISTDateParts(utcDate);

    expect(parts.dateString).toBe("2026-08-01");
    expect(parts.timeString).toBe("00:15");
  });

  it("handles year boundary correctly (Dec 31 18:45 UTC = Jan 1 IST next year)", () => {
    const utcDate = new Date("2026-12-31T18:45:00.000Z");
    const parts = getISTDateParts(utcDate);

    expect(parts.dateString).toBe("2027-01-01");
    expect(parts.timeString).toBe("00:15");
  });
});

describe("Biometric Attendance Derivation Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(prisma));
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as any);
  });

  it("1. Single IN punch creates an open AttendanceSession with checkOut=null", async () => {
    const employeeId = 421;
    const attendanceDate = new Date("2026-08-17T00:00:00.000Z");

    // Mock biometric punch (09:00 IST = 03:30 UTC)
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([
      {
        id: 1,
        source: "ESSL",
        tableName: "dbo.DeviceLogs_8_2026",
        deviceLogId: 100,
        employeeCode: "660099",
        employeeId: 421,
        punchedAt: new Date("2026-08-17T03:30:00.000Z"), // 09:00 IST
        deviceId: 1,
        metadata: {},
        createdAt: new Date(),
      },
    ] as any);

    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.attendanceRecord.create).mockResolvedValue({
      id: 99,
      remarks: "Biometric Device Ingestion",
    } as any);

    vi.mocked(prisma.attendanceSession.findMany).mockResolvedValue([
      { id: 501, attendanceId: 99, checkIn: "09:00", checkOut: null, workedMinutes: 0 },
    ] as any);

    await deriveAttendanceForEmployeeDate(employeeId, attendanceDate);

    // Verify session creation: single check-in, checkOut = null
    expect(prisma.attendanceSession.createMany).toHaveBeenCalledWith({
      data: [
        {
          attendanceId: 99,
          checkIn: "09:00",
          checkOut: null,
          workedMinutes: 0,
        },
      ],
    });

    // Verify daily totals update: checkIn="09:00", checkOut=null, workedMinutes=0, status="Short Hours"
    expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        checkIn: "09:00",
        checkOut: null,
        workedMinutes: 0,
        status: "Short Hours",
      }),
    });
  });

  it("2. IN -> OUT pairs into a single completed AttendanceSession with status=Present", async () => {
    const employeeId = 421;
    const attendanceDate = new Date("2026-08-17T00:00:00.000Z");

    // 09:00 IST (03:30 UTC) and 18:00 IST (12:30 UTC) -> 9 hours = 540 minutes
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([
      {
        id: 1,
        source: "ESSL",
        tableName: "dbo.DeviceLogs_8_2026",
        deviceLogId: 101,
        employeeCode: "660099",
        employeeId: 421,
        punchedAt: new Date("2026-08-17T03:30:00.000Z"),
        deviceId: 1,
      },
      {
        id: 2,
        source: "ESSL",
        tableName: "dbo.DeviceLogs_8_2026",
        deviceLogId: 102,
        employeeCode: "660099",
        employeeId: 421,
        punchedAt: new Date("2026-08-17T12:30:00.000Z"),
        deviceId: 1,
      },
    ] as any);

    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({
      id: 99,
      remarks: "Biometric Device Ingestion",
    } as any);

    vi.mocked(prisma.attendanceSession.findMany).mockResolvedValue([
      { id: 501, attendanceId: 99, checkIn: "09:00", checkOut: "18:00", workedMinutes: 540 },
    ] as any);

    await deriveAttendanceForEmployeeDate(employeeId, attendanceDate);

    expect(prisma.attendanceSession.createMany).toHaveBeenCalledWith({
      data: [
        {
          attendanceId: 99,
          checkIn: "09:00",
          checkOut: "18:00",
          workedMinutes: 540,
        },
      ],
    });

    expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        checkIn: "09:00",
        checkOut: "18:00",
        workedMinutes: 540,
        status: "Present",
      }),
    });
  });

  it("3. IN -> OUT -> IN -> OUT pairs into 2 completed sessions and sums workedMinutes", async () => {
    const employeeId = 421;
    const attendanceDate = new Date("2026-08-17T00:00:00.000Z");

    // Session 1: 09:00 to 13:00 (4h = 240m)
    // Session 2: 14:00 to 18:00 (4h = 240m) -> Total = 480m (Present)
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([
      {
        id: 1,
        punchedAt: new Date("2026-08-17T03:30:00.000Z"), // 09:00 IST
      },
      {
        id: 2,
        punchedAt: new Date("2026-08-17T07:30:00.000Z"), // 13:00 IST
      },
      {
        id: 3,
        punchedAt: new Date("2026-08-17T08:30:00.000Z"), // 14:00 IST
      },
      {
        id: 4,
        punchedAt: new Date("2026-08-17T12:30:00.000Z"), // 18:00 IST
      },
    ] as any);

    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({
      id: 99,
      remarks: "Biometric Device Ingestion",
    } as any);

    vi.mocked(prisma.attendanceSession.findMany).mockResolvedValue([
      { id: 501, attendanceId: 99, checkIn: "09:00", checkOut: "13:00", workedMinutes: 240 },
      { id: 502, attendanceId: 99, checkIn: "14:00", checkOut: "18:00", workedMinutes: 240 },
    ] as any);

    await deriveAttendanceForEmployeeDate(employeeId, attendanceDate);

    expect(prisma.attendanceSession.createMany).toHaveBeenCalledWith({
      data: [
        { attendanceId: 99, checkIn: "09:00", checkOut: "13:00", workedMinutes: 240 },
        { attendanceId: 99, checkIn: "14:00", checkOut: "18:00", workedMinutes: 240 },
      ],
    });

    expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        checkIn: "09:00",
        checkOut: "18:00",
        workedMinutes: 480,
        status: "Present",
      }),
    });
  });

  it("4. Odd number of punches (3 punches) leaves the 2nd session open", async () => {
    const employeeId = 421;
    const attendanceDate = new Date("2026-08-17T00:00:00.000Z");

    // Punch 1: 09:00 IST, Punch 2: 13:00 IST, Punch 3: 14:00 IST (open)
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([
      { id: 1, punchedAt: new Date("2026-08-17T03:30:00.000Z") },
      { id: 2, punchedAt: new Date("2026-08-17T07:30:00.000Z") },
      { id: 3, punchedAt: new Date("2026-08-17T08:30:00.000Z") },
    ] as any);

    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({ id: 99 } as any);
    vi.mocked(prisma.attendanceSession.findMany).mockResolvedValue([
      { id: 501, attendanceId: 99, checkIn: "09:00", checkOut: "13:00", workedMinutes: 240 },
      { id: 502, attendanceId: 99, checkIn: "14:00", checkOut: null, workedMinutes: 0 },
    ] as any);

    await deriveAttendanceForEmployeeDate(employeeId, attendanceDate);

    expect(prisma.attendanceSession.createMany).toHaveBeenCalledWith({
      data: [
        { attendanceId: 99, checkIn: "09:00", checkOut: "13:00", workedMinutes: 240 },
        { attendanceId: 99, checkIn: "14:00", checkOut: null, workedMinutes: 0 },
      ],
    });

    // Record checkOut remains null because the last session is open
    expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        checkIn: "09:00",
        checkOut: null,
        workedMinutes: 240,
        status: "Short Hours",
      }),
    });
  });

  it("9. Late punch self-healing: inserting 09:00 AM before existing 10:00 AM re-pairs properly", async () => {
    const employeeId = 421;
    const attendanceDate = new Date("2026-08-17T00:00:00.000Z");

    // Existing punches were 10:00, 13:00, 14:00, 18:00.
    // Late punch 09:00 arrives.
    // Full punch history ordered by punchedAt: 09:00, 10:00, 13:00, 14:00, 18:00
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([
      { id: 5, punchedAt: new Date("2026-08-17T03:30:00.000Z") }, // 09:00 (late punch)
      { id: 1, punchedAt: new Date("2026-08-17T04:30:00.000Z") }, // 10:00
      { id: 2, punchedAt: new Date("2026-08-17T07:30:00.000Z") }, // 13:00
      { id: 3, punchedAt: new Date("2026-08-17T08:30:00.000Z") }, // 14:00
      { id: 4, punchedAt: new Date("2026-08-17T12:30:00.000Z") }, // 18:00
    ] as any);

    vi.mocked(prisma.attendanceRecord.findUnique).mockResolvedValue({ id: 99 } as any);
    vi.mocked(prisma.attendanceSession.findMany).mockResolvedValue([
      { id: 501, attendanceId: 99, checkIn: "09:00", checkOut: "10:00", workedMinutes: 60 },
      { id: 502, attendanceId: 99, checkIn: "13:00", checkOut: "14:00", workedMinutes: 60 },
      { id: 503, attendanceId: 99, checkIn: "18:00", checkOut: null, workedMinutes: 0 },
    ] as any);

    await deriveAttendanceForEmployeeDate(employeeId, attendanceDate);

    // Verify self-healed sessions:
    // Session 1: 09:00 -> 10:00 (60m)
    // Session 2: 13:00 -> 14:00 (60m)
    // Session 3: 18:00 -> null (open)
    expect(prisma.attendanceSession.createMany).toHaveBeenCalledWith({
      data: [
        { attendanceId: 99, checkIn: "09:00", checkOut: "10:00", workedMinutes: 60 },
        { attendanceId: 99, checkIn: "13:00", checkOut: "14:00", workedMinutes: 60 },
        { attendanceId: 99, checkIn: "18:00", checkOut: null, workedMinutes: 0 },
      ],
    });
  });

  it("17-18. Unmapped employee punches do not create AttendanceRecord or AttendanceSession", async () => {
    vi.mocked(prisma.employee.findMany).mockResolvedValue([]);
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.biometricPunch.createMany).mockResolvedValue({ count: 1 });

    const payload = {
      events: [
        {
          source: "ESSL",
          tableName: "dbo.DeviceLogs_8_2026",
          deviceLogId: 999,
          employeeCode: "UNMAPPED_EMP",
          punchedAt: "2026-08-17T14:36:43.000Z",
          deviceId: 14,
        },
      ],
    };

    const res = await ingestBiometricPunches(payload);

    expect(res.unmappedCount).toBe(1);
    expect(res.processedCount).toBe(0);
    expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
    expect(prisma.attendanceSession.createMany).not.toHaveBeenCalled();
  });
});
