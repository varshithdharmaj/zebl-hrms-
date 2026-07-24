import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginSessionStatus } from "@/generated/prisma/client";
import { createSessionToken, type SessionUser } from "@/lib/session";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    loginSession: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/session-version-cache", () => ({
  setCachedSessionVersion: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { setCachedSessionVersion } from "@/lib/session-version-cache";
import { resolveSessionFromToken } from "@/lib/auth";

const baseUser: SessionUser = {
  id: "user-1",
  email: "hr@zebl.com",
  role: "hr",
  employeeId: 10,
  employeeName: "HR User",
  sessionVersion: 3,
  authProvider: "local",
  mustChangePassword: false,
};

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "hr@zebl.com",
    role: "hr",
    employeeId: 10,
    sessionVersion: 3,
    authProvider: "local",
    mustChangePassword: false,
    isActive: true,
    password: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    employee: {
      name: "HR User",
      employeeStatus: "Active",
      isActive: true,
    },
    ...overrides,
  };
}

describe("resolveSessionFromToken (Phase 5M parallel reads)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET ??= "test-auth-secret-phase5m-0123456789";
  });

  it("returns SessionUser for a valid active/current session and matching version", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser() as never);
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue({
      lastActivityAt: new Date(),
    } as never);

    const session = await resolveSessionFromToken(token);

    expect(session).toMatchObject({
      id: "user-1",
      email: "hr@zebl.com",
      role: "hr",
      employeeId: 10,
      employeeName: "HR User",
      sessionVersion: 3,
      sessionId: "session-1",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      include: { employee: true },
    });
    expect(prisma.loginSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        status: LoginSessionStatus.active,
        isCurrent: true,
      },
      select: { lastActivityAt: true },
    });
    expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
    expect(setCachedSessionVersion).toHaveBeenCalledWith("user-1", 3);
  });

  it("starts user and login-session reads concurrently", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    let inFlight = 0;
    let maxInFlight = 0;

    const track = async <T>(value: T): Promise<T> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return value;
    };

    vi.mocked(prisma.user.findUnique).mockImplementation((() =>
      track(dbUser() as never)
    ) as never);
    vi.mocked(prisma.loginSession.findFirst).mockImplementation((() =>
      track({ lastActivityAt: new Date() } as never)
    ) as never);

    await resolveSessionFromToken(token);
    expect(maxInFlight).toBe(2);
  });

  it("rejects when user does not exist", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue({
      lastActivityAt: new Date(),
    } as never);

    await expect(resolveSessionFromToken(token)).resolves.toBeNull();
    expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
  });

  it("rejects inactive users", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      dbUser({ isActive: false }) as never
    );
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue({
      lastActivityAt: new Date(),
    } as never);

    await expect(resolveSessionFromToken(token)).resolves.toBeNull();
    expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
  });

  it("rejects session-version mismatch", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      dbUser({ sessionVersion: 99 }) as never
    );
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue({
      lastActivityAt: new Date(),
    } as never);

    await expect(resolveSessionFromToken(token)).resolves.toBeNull();
    expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
  });

  it("rejects missing login session", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser() as never);
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue(null);

    await expect(resolveSessionFromToken(token)).resolves.toBeNull();
    expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
  });

  it("rejects inactive login session via findFirst predicates", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser() as never);
    // findFirst already filters status=active; inactive → null
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue(null);

    await expect(resolveSessionFromToken(token)).resolves.toBeNull();
    expect(prisma.loginSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: LoginSessionStatus.active,
          isCurrent: true,
        }),
      })
    );
  });

  it("rejects non-current login session via findFirst predicates", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser() as never);
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue(null);

    await expect(resolveSessionFromToken(token)).resolves.toBeNull();
    expect(prisma.loginSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isCurrent: true }),
      })
    );
  });

  it("does not update activity when lastActivityAt is fresh", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser() as never);
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue({
      lastActivityAt: new Date(),
    } as never);

    const session = await resolveSessionFromToken(token);
    expect(session?.id).toBe("user-1");
    expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
  });

  it("touches activity only after validation when stale", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    const staleAt = new Date(Date.now() - 6 * 60 * 1000);
    const callOrder: string[] = [];

    vi.mocked(prisma.user.findUnique).mockImplementation((async () => {
      callOrder.push("user");
      return dbUser() as never;
    }) as never);
    vi.mocked(prisma.loginSession.findFirst).mockImplementation((async () => {
      callOrder.push("session");
      return { lastActivityAt: staleAt } as never;
    }) as never);
    vi.mocked(prisma.loginSession.updateMany).mockImplementation((async () => {
      callOrder.push("touch");
      return { count: 1 } as never;
    }) as never);

    const session = await resolveSessionFromToken(token);
    expect(session?.id).toBe("user-1");
    expect(callOrder.indexOf("touch")).toBeGreaterThan(callOrder.indexOf("user"));
    expect(callOrder.indexOf("touch")).toBeGreaterThan(callOrder.indexOf("session"));
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

  it("does not touch activity when validation fails even if session row is stale", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      dbUser({ isActive: false }) as never
    );
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue({
      lastActivityAt: new Date(Date.now() - 6 * 60 * 1000),
    } as never);

    await expect(resolveSessionFromToken(token)).resolves.toBeNull();
    expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
  });

  it("returns null when user read fails", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("db down"));
    vi.mocked(prisma.loginSession.findFirst).mockResolvedValue({
      lastActivityAt: new Date(),
    } as never);

    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(resolveSessionFromToken(token)).resolves.toBeNull();
    err.mockRestore();
  });

  it("propagates login-session read failures", async () => {
    const token = await createSessionToken(baseUser, "session-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser() as never);
    vi.mocked(prisma.loginSession.findFirst).mockRejectedValue(
      new Error("session db fail")
    );

    await expect(resolveSessionFromToken(token)).rejects.toThrow("session db fail");
  });
});
