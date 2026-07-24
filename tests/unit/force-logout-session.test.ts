import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginSessionStatus } from "@/generated/prisma/enums";
import { PermissionError } from "@/lib/permissions";

const requireSuperAdminSession = vi.fn();
const requireEmployeeSession = vi.fn();
const closeSession = vi.fn();
const closeAllUserSessions = vi.fn();
const invalidateUserSessionsWithAudit = vi.fn();
const clearSessionCookie = vi.fn();
const writeAuditLog = vi.fn();
const findUnique = vi.fn();
const getRequestSecurityContext = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireSuperAdminSession: () => requireSuperAdminSession(),
  requireEmployeeSession: () => requireEmployeeSession(),
}));

vi.mock("@/lib/auth", () => ({
  clearSessionCookie: () => clearSessionCookie(),
  invalidateUserSessionsWithAudit: (...args: unknown[]) =>
    invalidateUserSessionsWithAudit(...args),
}));

vi.mock("@/lib/security/login-history-service", () => ({
  closeSession: (...args: unknown[]) => closeSession(...args),
  closeAllUserSessions: (...args: unknown[]) => closeAllUserSessions(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loginSession: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    AUTH_SESSION_INVALIDATED: "auth.session.invalidated",
  },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

vi.mock("@/lib/security/request-context", () => ({
  getRequestSecurityContext: () => getRequestSecurityContext(),
}));

import { forceLogoutSessionAction } from "@/actions/security";

const saActor = {
  id: "sa-1",
  email: "sa@zebl.com",
  role: "super_admin" as const,
  employeeId: null,
  sessionId: "sa-current-session",
};

function formData(sessionId: string): FormData {
  const fd = new FormData();
  fd.set("sessionId", sessionId);
  return fd;
}

describe("forceLogoutSessionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestSecurityContext.mockResolvedValue({
      ipAddress: "127.0.0.1",
      userAgent: "test",
    });
    closeSession.mockResolvedValue(true);
    writeAuditLog.mockResolvedValue(undefined);
    clearSessionCookie.mockResolvedValue(undefined);
  });

  it("denies non–Super Admin callers", async () => {
    requireSuperAdminSession.mockRejectedValue(new PermissionError());
    await expect(forceLogoutSessionAction(formData("sess-1"))).rejects.toBeInstanceOf(
      PermissionError
    );
    expect(closeSession).not.toHaveBeenCalled();
    expect(invalidateUserSessionsWithAudit).not.toHaveBeenCalled();
  });

  it("revokes only the selected LoginSession (not user-wide sessionVersion)", async () => {
    requireSuperAdminSession.mockResolvedValue(saActor);
    findUnique.mockResolvedValue({ userId: "target-user", employeeId: 10 });

    await forceLogoutSessionAction(formData("target-session"));

    expect(closeSession).toHaveBeenCalledWith(
      "target-session",
      LoginSessionStatus.revoked
    );
    expect(invalidateUserSessionsWithAudit).not.toHaveBeenCalled();
    expect(closeAllUserSessions).not.toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "target-session",
        action: "auth.session.invalidated",
        metadata: expect.objectContaining({
          reason: "super_admin_force_logout",
          targetUserId: "target-user",
        }),
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/security/active-sessions");
    expect(clearSessionCookie).not.toHaveBeenCalled();
  });

  it("clears the cookie when Super Admin force-logs out their own current session", async () => {
    requireSuperAdminSession.mockResolvedValue(saActor);
    findUnique.mockResolvedValue({ userId: saActor.id, employeeId: null });

    await expect(
      forceLogoutSessionAction(formData("sa-current-session"))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(closeSession).toHaveBeenCalledWith(
      "sa-current-session",
      LoginSessionStatus.revoked
    );
    expect(clearSessionCookie).toHaveBeenCalled();
    expect(invalidateUserSessionsWithAudit).not.toHaveBeenCalled();
  });

  it("no-ops when session id is missing or unknown", async () => {
    requireSuperAdminSession.mockResolvedValue(saActor);
    findUnique.mockResolvedValue(null);

    await forceLogoutSessionAction(formData("missing"));
    expect(closeSession).not.toHaveBeenCalled();

    await forceLogoutSessionAction(new FormData());
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
