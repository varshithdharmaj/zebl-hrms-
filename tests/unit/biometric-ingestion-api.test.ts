import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, GET } from "@/app/api/integrations/attendance/ingest/route";
import {
  ingestBiometricPunches,
  biometricPunchEventSchema,
  ingestBiometricPunchesSchema,
} from "@/lib/integrations/biometric-ingestion";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue(null),
}));

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
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 100, remarks: "Biometric Device Ingestion" }),
      update: vi.fn().mockResolvedValue({ id: 100 }),
      delete: vi.fn().mockResolvedValue({ id: 100 }),
    },
    attendanceSession: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(prisma)),
    $executeRaw: vi.fn().mockResolvedValue(1),
  },
}));

describe("Biometric Ingestion Schemas & Validation", () => {
  it("validates a standard valid event", () => {
    const validEvent = {
      source: "essl",
      tableName: "dbo.DeviceLogs_8_2026",
      deviceLogId: 10540,
      employeeCode: "660099",
      punchedAt: "2026-08-17T14:36:43.000Z",
      deviceId: 14,
      metadata: { direction: "IN" },
    };
    const parsed = biometricPunchEventSchema.parse(validEvent);
    expect(parsed.source).toBe("essl");
    expect(parsed.tableName).toBe("dbo.DeviceLogs_8_2026");
    expect(parsed.deviceLogId).toBe(10540);
    expect(parsed.employeeCode).toBe("660099");
    expect(parsed.punchedAt).toBeInstanceOf(Date);
  });

  it("accepts tableName without dbo. prefix (e.g. DeviceLogs_12_2025)", () => {
    const validEvent = {
      source: "ESSL",
      tableName: "DeviceLogs_12_2025",
      deviceLogId: 100,
      employeeCode: "EMP01",
      punchedAt: "2026-08-17T10:00:00Z",
      deviceId: 1,
    };
    const parsed = biometricPunchEventSchema.parse(validEvent);
    expect(parsed.tableName).toBe("DeviceLogs_12_2025");
  });

  it("rejects invalid tableName format (preventing SQL identifier injection)", () => {
    const invalidEvent = {
      source: "ESSL",
      tableName: "dbo.Users; DROP TABLE users;--",
      deviceLogId: 100,
      employeeCode: "EMP01",
      punchedAt: "2026-08-17T10:00:00Z",
      deviceId: 1,
    };
    expect(() => biometricPunchEventSchema.parse(invalidEvent)).toThrow();
  });

  it("rejects non-positive or non-integer deviceLogId", () => {
    expect(() =>
      biometricPunchEventSchema.parse({
        source: "ESSL",
        tableName: "dbo.DeviceLogs_8_2026",
        deviceLogId: 0,
        employeeCode: "EMP01",
        punchedAt: "2026-08-17T10:00:00Z",
        deviceId: 1,
      })
    ).toThrow();

    expect(() =>
      biometricPunchEventSchema.parse({
        source: "ESSL",
        tableName: "dbo.DeviceLogs_8_2026",
        deviceLogId: -10,
        employeeCode: "EMP01",
        punchedAt: "2026-08-17T10:00:00Z",
        deviceId: 1,
      })
    ).toThrow();
  });

  it("rejects invalid punchedAt ISO dates", () => {
    expect(() =>
      biometricPunchEventSchema.parse({
        source: "ESSL",
        tableName: "dbo.DeviceLogs_8_2026",
        deviceLogId: 100,
        employeeCode: "EMP01",
        punchedAt: "not-a-valid-date",
        deviceId: 1,
      })
    ).toThrow();
  });

  it("rejects empty events array", () => {
    expect(() => ingestBiometricPunchesSchema.parse({ events: [] })).toThrow();
  });

  it("rejects oversized batch exceeding 500 events", () => {
    const sampleEvent = {
      source: "ESSL",
      tableName: "dbo.DeviceLogs_8_2026",
      deviceLogId: 100,
      employeeCode: "EMP01",
      punchedAt: "2026-08-17T10:00:00Z",
      deviceId: 1,
    };
    const oversized = Array.from({ length: 501 }, (_, i) => ({
      ...sampleEvent,
      deviceLogId: i + 1,
    }));
    expect(() => ingestBiometricPunchesSchema.parse({ events: oversized })).toThrow();
  });
});

describe("ingestBiometricPunches Service Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes mapped, unmapped, and duplicate events correctly", async () => {
    // Mock employee lookup: 660099 exists with id 421; UNMAPPED_CODE does not exist
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: 421, employeeCode: "660099" },
    ] as any);

    // Mock existing DB biometric punches: (ESSL, dbo.DeviceLogs_8_2026, 9999) already exists
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([
      { source: "ESSL", tableName: "dbo.DeviceLogs_8_2026", deviceLogId: 9999 },
    ] as any);

    vi.mocked(prisma.biometricPunch.createMany).mockResolvedValue({ count: 2 });

    const payload = {
      events: [
        {
          source: "essl",
          tableName: "dbo.DeviceLogs_8_2026",
          deviceLogId: 1001,
          employeeCode: "660099",
          punchedAt: "2026-08-17T14:36:43.000Z",
          deviceId: 14,
        },
        {
          source: "essl",
          tableName: "dbo.DeviceLogs_8_2026",
          deviceLogId: 1002,
          employeeCode: "UNMAPPED_CODE",
          punchedAt: "2026-08-17T14:37:00.000Z",
          deviceId: 14,
        },
        {
          source: "essl",
          tableName: "dbo.DeviceLogs_8_2026",
          deviceLogId: 9999, // duplicate from DB
          employeeCode: "660099",
          punchedAt: "2026-08-17T14:38:00.000Z",
          deviceId: 14,
        },
        {
          source: "essl",
          tableName: "dbo.DeviceLogs_8_2026",
          deviceLogId: 1001, // intra-batch duplicate of event 1
          employeeCode: "660099",
          punchedAt: "2026-08-17T14:36:43.000Z",
          deviceId: 14,
        },
      ],
    };

    const response = await ingestBiometricPunches(payload);

    expect(response.processedCount).toBe(1);
    expect(response.unmappedCount).toBe(1);
    expect(response.duplicateCount).toBe(2);
    expect(response.results).toEqual([
      { deviceLogId: 1001, status: "success" },
      { deviceLogId: 1002, status: "unmapped" },
      { deviceLogId: 9999, status: "duplicate" },
      { deviceLogId: 1001, status: "duplicate" },
    ]);

    // Verify createMany call: source canonicalized to "ESSL", employeeId set for mapped, null for unmapped
    expect(prisma.biometricPunch.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          source: "ESSL",
          tableName: "dbo.DeviceLogs_8_2026",
          deviceLogId: 1001,
          employeeCode: "660099",
          employeeId: 421,
        }),
        expect.objectContaining({
          source: "ESSL",
          tableName: "dbo.DeviceLogs_8_2026",
          deviceLogId: 1002,
          employeeCode: "UNMAPPED_CODE",
          employeeId: null,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("handles same deviceLogId across different monthly tables as separate events", async () => {
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: 421, employeeCode: "660099" },
    ] as any);

    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([
      { source: "ESSL", tableName: "dbo.DeviceLogs_7_2026", deviceLogId: 500 },
    ] as any);

    vi.mocked(prisma.biometricPunch.createMany).mockResolvedValue({ count: 1 });

    const payload = {
      events: [
        {
          source: "ESSL",
          tableName: "dbo.DeviceLogs_8_2026", // August table
          deviceLogId: 500, // Same log ID as July table
          employeeCode: "660099",
          punchedAt: "2026-08-01T08:00:00Z",
          deviceId: 1,
        },
      ],
    };

    const response = await ingestBiometricPunches(payload);

    expect(response.processedCount).toBe(1);
    expect(response.duplicateCount).toBe(0);
    expect(response.results).toEqual([{ deviceLogId: 500, status: "success" }]);
  });
});

describe("POST /api/integrations/attendance/ingest Route Handler", () => {
  const originalEnv = process.env.ATTENDANCE_BRIDGE_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ATTENDANCE_BRIDGE_SECRET = "test-bridge-secret-123";
  });

  afterEach(() => {
    process.env.ATTENDANCE_BRIDGE_SECRET = originalEnv;
  });

  it("rejects request without Authorization header with 401", async () => {
    const req = new Request("http://localhost/api/integrations/attendance/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("rejects request with invalid Bearer token with 401", async () => {
    const req = new Request("http://localhost/api/integrations/attendance/ingest", {
      method: "POST",
      headers: {
        Authorization: "Bearer wrong-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("accepts valid Bearer token and returns 200 with result payload", async () => {
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: 421, employeeCode: "660099" },
    ] as any);
    vi.mocked(prisma.biometricPunch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.biometricPunch.createMany).mockResolvedValue({ count: 1 });

    const req = new Request("http://localhost/api/integrations/attendance/ingest", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-bridge-secret-123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            source: "ESSL",
            tableName: "dbo.DeviceLogs_8_2026",
            deviceLogId: 10540,
            employeeCode: "660099",
            punchedAt: "2026-08-17T14:36:43.000Z",
            deviceId: 14,
            metadata: { direction: "IN" },
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toEqual({
      processedCount: 1,
      duplicateCount: 0,
      unmappedCount: 0,
      results: [
        {
          deviceLogId: 10540,
          status: "success",
        },
      ],
    });
  });

  it("returns 400 when body payload validation fails", async () => {
    const req = new Request("http://localhost/api/integrations/attendance/ingest", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-bridge-secret-123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            source: "ESSL",
            tableName: "invalid_table_name",
            deviceLogId: -1,
            employeeCode: "",
            punchedAt: "bad-date",
            deviceId: 14,
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid request payload.");
    expect(json.details.length).toBeGreaterThan(0);
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new Request("http://localhost/api/integrations/attendance/ingest", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-bridge-secret-123",
        "Content-Type": "application/json",
      },
      body: "{ malformed json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON request body.");
  });

  it("returns 405 Method Not Allowed for GET request", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });

  it("returns 500 without leaking stack traces when unexpected server error occurs", async () => {
    vi.mocked(prisma.employee.findMany).mockRejectedValue(
      new Error("Database connection lost")
    );

    const req = new Request("http://localhost/api/integrations/attendance/ingest", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-bridge-secret-123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            source: "ESSL",
            tableName: "dbo.DeviceLogs_8_2026",
            deviceLogId: 10540,
            employeeCode: "660099",
            punchedAt: "2026-08-17T14:36:43.000Z",
            deviceId: 14,
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({
      error: "Internal server error during biometric punch ingestion.",
    });
    expect(json.stack).toBeUndefined();
    expect(json.message).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("Database connection lost");
  });
});
