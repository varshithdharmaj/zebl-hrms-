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

import { logoutSessionAction } from "@/actions/security";

const employeeActor = {
  id: "emp-user-1",
  email: "emp@zebl.com",
  role: "employee" as const,
  employeeId: 10,
  sessionId: "emp-current",
};

function formData(sessionId: string): FormData {
  const fd = new FormData();
  fd.set("sessionId", sessionId);
  return fd;
}

describe("logoutSessionAction", () => {
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

  it("revokes another owned session and revalidates the security hub", async () => {
    requireEmployeeSession.mockResolvedValue(employeeActor);
    findUnique.mockResolvedValue({ userId: employeeActor.id });

    await logoutSessionAction(formData("other-session"));

    expect(closeSession).toHaveBeenCalledWith(
      "other-session",
      LoginSessionStatus.revoked
    );
    expect(revalidatePath).toHaveBeenCalledWith("/employee/security");
    expect(clearSessionCookie).not.toHaveBeenCalled();
  });

  it("denies revoking another user's session", async () => {
    requireEmployeeSession.mockResolvedValue(employeeActor);
    findUnique.mockResolvedValue({ userId: "someone-else" });

    await logoutSessionAction(formData("foreign-session"));
    expect(closeSession).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    requireEmployeeSession.mockRejectedValue(new PermissionError());
    await expect(logoutSessionAction(formData("sess-1"))).rejects.toBeInstanceOf(
      PermissionError
    );
  });
});
