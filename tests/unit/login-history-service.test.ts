import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginSessionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  closeSession,
  findActiveCurrentLoginSession,
  getActiveSessions,
  getLoginHistory,
  getLoginHistoryExportRows,
  getSecuritySummary,
  getSessions,
  normalizeSessionView,
  recordFailedLogin,
  recordSuccessfulLogin,
  resolveSessionStatusFilter,
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

  it("getActiveSessions returns all active sessions ordered by lastActivityAt", async () => {
    vi.mocked(prisma.loginSession.findMany)
      .mockResolvedValueOnce([]) // expireStaleSessions
      .mockResolvedValueOnce([
        {
          id: "s1",
          lastActivityAt: new Date(),
          status: LoginSessionStatus.active,
        },
      ] as never);

    const rows = await getActiveSessions({ employeeId: 42 });
    expect(rows).toHaveLength(1);
    expect(prisma.loginSession.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          status: LoginSessionStatus.active,
          isCurrent: true,
          employeeId: 42,
        },
        orderBy: { lastActivityAt: "desc" },
      })
    );
  });

  it("getActiveSessions can skip expire when the hub already expired stale rows", async () => {
    vi.mocked(prisma.loginSession.findMany).mockResolvedValue([]);
    await getActiveSessions(undefined, { skipExpire: true });
    expect(prisma.loginSession.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.loginSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: LoginSessionStatus.active,
          isCurrent: true,
        },
      })
    );
  });

  it("getSecuritySummary returns counts, current device, and recent events", async () => {
    const now = new Date();
    vi.mocked(prisma.loginSession.count).mockResolvedValue(2);
    vi.mocked(prisma.loginSession.findFirst)
      .mockResolvedValueOnce({
        id: "current",
        loginAt: now,
        lastActivityAt: now,
        browser: "Chrome",
        operatingSystem: "Windows",
        ipAddress: "192.0.2.1",
        device: "Desktop",
      } as never)
      .mockResolvedValueOnce({
        id: "last",
        loginAt: now,
        browser: "Chrome",
        operatingSystem: "Windows",
        ipAddress: "192.0.2.1",
        device: "Desktop",
      } as never)
      .mockResolvedValueOnce({
        id: "failed",
        loginAt: now,
        failureReason: "invalid_credentials",
        attemptedEmail: "a@b.com",
        ipAddress: "192.0.2.2",
        browser: "Chrome",
      } as never);

    const summary = await getSecuritySummary({
      employeeId: 7,
      includeFailed: true,
      currentSessionId: "current",
    });

    expect(summary.activeSessionCount).toBe(2);
    expect(summary.currentDevice?.id).toBe("current");
    expect(summary.lastLogin?.id).toBe("last");
    expect(summary.lastFailedLogin?.failureReason).toBe("invalid_credentials");
    expect(prisma.loginSession.findFirst).toHaveBeenCalledTimes(3);
  });

  it("getSecuritySummary omits failed login lookup when includeFailed is false", async () => {
    vi.mocked(prisma.loginSession.count).mockResolvedValue(1);
    vi.mocked(prisma.loginSession.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const summary = await getSecuritySummary({
      employeeId: 7,
      currentSessionId: "missing",
    });

    expect(summary.lastFailedLogin).toBeNull();
    expect(prisma.loginSession.findFirst).toHaveBeenCalledTimes(2);
  });

  it("resolveSessionStatusFilter maps ended → logged_out and keeps legacy values", () => {
    expect(resolveSessionStatusFilter("ended")).toBe(LoginSessionStatus.logged_out);
    expect(resolveSessionStatusFilter("logged_out")).toBe(LoginSessionStatus.logged_out);
    expect(resolveSessionStatusFilter("active")).toBe(LoginSessionStatus.active);
    expect(resolveSessionStatusFilter("nope")).toBeUndefined();
  });

  it("normalizeSessionView marks the viewing device as current and revocable when allowed", () => {
    const row = {
      id: "sess-1",
      attemptedEmail: null,
      loginAt: new Date(),
      logoutAt: null,
      lastActivityAt: new Date(),
      status: LoginSessionStatus.active,
      ipAddress: "192.0.2.1",
      browser: "Chrome",
      browserVersion: "126",
      device: "Desktop",
      operatingSystem: "Windows",
      sessionDuration: null,
      failureReason: null,
      isCurrent: true,
      user: null,
      employee: null,
    };

    const current = normalizeSessionView(row, {
      currentSessionId: "sess-1",
      canRevoke: true,
    });
    expect(current.status).toBe("current");
    expect(current.isCurrent).toBe(true);
    expect(current.canRevoke).toBe(true);

    const other = normalizeSessionView({ ...row, id: "sess-2" }, {
      currentSessionId: "sess-1",
      canRevoke: true,
    });
    expect(other.status).toBe("active");
    expect(other.isCurrent).toBe(false);

    const ended = normalizeSessionView(
      { ...row, status: LoginSessionStatus.logged_out, logoutAt: new Date() },
      { currentSessionId: "other", canRevoke: true }
    );
    expect(ended.status).toBe("ended");
    expect(ended.canRevoke).toBe(false);
  });

  it("getSessions reuses login history and returns normalized rows", async () => {
    vi.mocked(prisma.loginSession.count).mockResolvedValue(1);
    vi.mocked(prisma.loginSession.findMany).mockResolvedValue([
      {
        id: "sess-1",
        attemptedEmail: null,
        loginAt: new Date(),
        logoutAt: null,
        lastActivityAt: new Date(),
        status: LoginSessionStatus.active,
        ipAddress: "192.0.2.1",
        browser: "Chrome",
        browserVersion: "126",
        device: "Desktop",
        operatingSystem: "Windows",
        sessionDuration: null,
        failureReason: null,
        isCurrent: true,
        user: null,
        employee: null,
      },
    ] as never);

    const result = await getSessions(
      { page: 1 },
      { employeeId: 1 },
      { currentSessionId: "sess-1", canRevoke: true }
    );
    expect(result.total).toBe(1);
    expect(result.rows[0]?.status).toBe("current");
    expect(result.rows[0]?.canRevoke).toBe(true);
  });

  it("honors role page-size defaults (employee 10, admin 20)", async () => {
    vi.mocked(prisma.loginSession.count).mockResolvedValue(0);
    vi.mocked(prisma.loginSession.findMany).mockResolvedValue([]);

    await getLoginHistory({ page: 1, pageSize: 10 });
    expect(prisma.loginSession.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 10 })
    );

    await getLoginHistory({ page: 1, pageSize: 20 });
    expect(prisma.loginSession.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });
});
