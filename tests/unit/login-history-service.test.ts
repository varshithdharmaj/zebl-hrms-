import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginSessionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  closeSession,
  findActiveCurrentLoginSession,
  getLoginHistory,
  getLoginHistoryExportRows,
  recordFailedLogin,
  recordSuccessfulLogin,
  touchLoginSessionActivityIfStale,
  validateAndTouchSession,
} from "@/lib/security/login-history-service";

vi.mock("@/lib/prisma", () => {
  const loginSession = {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  return {
    prisma: {
      loginSession,
      $transaction: vi.fn(async (input: unknown) => {
        if (typeof input === "function") {
          return input({ loginSession });
        }
        return Promise.all(input as Promise<unknown>[]);
      }),
    },
  };
});

const context = {
  ipAddress: "192.0.2.10",
  browser: "Chrome",
  browserVersion: "126",
  device: "Desktop",
  operatingSystem: "Windows",
  userAgent: "test-agent",
};

describe("LoginHistoryService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores successful sessions with a JWT id, user, employee and device context", async () => {
    vi.mocked(prisma.loginSession.create).mockResolvedValue({} as never);
    await recordSuccessfulLogin({
      sessionId: "session-1",
      userId: "user-1",
      employeeId: 10,
      context,
    });
    expect(prisma.loginSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "session-1",
        sessionToken: "session-1",
        userId: "user-1",
        employeeId: 10,
        status: LoginSessionStatus.active,
        browser: "Chrome",
      }),
    });
  });

  it("stores failed attempts without requiring an existing user", async () => {
    vi.mocked(prisma.loginSession.create).mockResolvedValue({} as never);
    await recordFailedLogin({
      attemptedEmail: "Unknown@Example.com",
      reason: "invalid_credentials",
      context,
    });
    expect(prisma.loginSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attemptedEmail: "unknown@example.com",
        status: LoginSessionStatus.failed,
        failureReason: "invalid_credentials",
        isCurrent: false,
      }),
    });
  });

  it("rejects a revoked or missing session token", async () => {
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue(null);
    await expect(validateAndTouchSession("revoked", "user-1")).resolves.toBe(false);
  });

  it("findActiveCurrentLoginSession requires active + current ownership", async () => {
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue({
      lastActivityAt: new Date(),
    } as never);
    await findActiveCurrentLoginSession("session-1", "user-1");
    expect(prisma.loginSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        status: LoginSessionStatus.active,
        isCurrent: true,
      },
      select: { lastActivityAt: true },
    });
  });

  it("touchLoginSessionActivityIfStale skips fresh activity", async () => {
    await touchLoginSessionActivityIfStale("session-1", "user-1", new Date());
    expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
  });

  it("touchLoginSessionActivityIfStale updates when stale with ownership guards", async () => {
    const staleAt = new Date(Date.now() - 6 * 60 * 1000);
    vi.mocked(prisma.loginSession.updateMany).mockResolvedValue({ count: 1 } as never);
    await touchLoginSessionActivityIfStale("session-1", "user-1", staleAt);
    expect(prisma.loginSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        status: LoginSessionStatus.active,
        lastActivityAt: staleAt,
      },
      data: { lastActivityAt: expect.any(Date) },
    });
  });

  it("scopes employee history to the requested employee id", async () => {
    vi.mocked(prisma.loginSession.count).mockResolvedValue(0);
    vi.mocked(prisma.loginSession.findMany).mockResolvedValue([]);
    await getLoginHistory({}, { employeeId: 42 });
    expect(prisma.loginSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 42,
          status: { not: LoginSessionStatus.failed },
        }),
      })
    );
  });

  it("does not return failed logins when includeFailed is false even if status=failed", async () => {
    vi.mocked(prisma.loginSession.count).mockResolvedValue(0);
    vi.mocked(prisma.loginSession.findMany).mockResolvedValue([]);
    await getLoginHistory(
      { status: LoginSessionStatus.failed },
      { includeFailed: false }
    );
    expect(prisma.loginSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "__failed_login_access_denied__",
        }),
      })
    );
  });

  it("ignores status=failed when includeFailed is omitted", async () => {
    vi.mocked(prisma.loginSession.count).mockResolvedValue(0);
    vi.mocked(prisma.loginSession.findMany).mockResolvedValue([]);
    await getLoginHistory({ status: LoginSessionStatus.failed });
    expect(prisma.loginSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "__failed_login_access_denied__",
        }),
      })
    );
  });

  it("allows Super Admin (includeFailed) to filter status=failed", async () => {
    vi.mocked(prisma.loginSession.count).mockResolvedValue(0);
    vi.mocked(prisma.loginSession.findMany).mockResolvedValue([]);
    await getLoginHistory(
      { status: LoginSessionStatus.failed },
      { includeFailed: true }
    );
    expect(prisma.loginSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: LoginSessionStatus.failed,
        }),
      })
    );
  });

  it("export rows deny failed status when includeFailed is false", async () => {
    vi.mocked(prisma.loginSession.findMany).mockResolvedValue([]);
    await getLoginHistoryExportRows({ status: LoginSessionStatus.failed }, false);
    expect(prisma.loginSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "__failed_login_access_denied__",
        }),
      })
    );
  });

  it("export rows allow failed status when includeFailed is true", async () => {
    vi.mocked(prisma.loginSession.findMany).mockResolvedValue([]);
    await getLoginHistoryExportRows({ status: LoginSessionStatus.failed }, true);
    expect(prisma.loginSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: LoginSessionStatus.failed,
        }),
      })
    );
  });

  it("calculates duration and expires a timed-out session", async () => {
    vi.mocked(prisma.loginSession.findUnique).mockResolvedValue({
      loginAt: new Date(Date.now() - 90_000),
      status: LoginSessionStatus.active,
    } as never);
    vi.mocked(prisma.loginSession.update).mockResolvedValue({} as never);
    await expect(closeSession("session-1", LoginSessionStatus.expired)).resolves.toBe(true);
    expect(prisma.loginSession.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({
        status: LoginSessionStatus.expired,
        isCurrent: false,
        sessionDuration: expect.any(Number),
      }),
    });
  });
});
