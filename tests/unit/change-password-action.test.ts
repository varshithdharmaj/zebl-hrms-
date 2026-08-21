import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const invalidateUserSessions = vi.fn();
const getRequestClientIp = vi.fn();
const clearSessionCookie = vi.fn();
const getDefaultRedirect = vi.fn((role: string) =>
  role === "super_admin" || role === "hr" ? "/admin/dashboard" : "/employee/dashboard"
);
const establishSession = vi.fn();
const writeAuditLog = vi.fn();
const getRequestSecurityContext = vi.fn();
const findUnique = vi.fn();
const update = vi.fn();
const bcryptCompare = vi.fn();
const bcryptHash = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: (...args: unknown[]) => bcryptCompare(...args),
    hash: (...args: unknown[]) => bcryptHash(...args),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
  invalidateUserSessions: (...args: unknown[]) => invalidateUserSessions(...args),
  invalidateUserSessionsWithAudit: vi.fn(),
  getDefaultRedirect: (...args: unknown[]) => getDefaultRedirect(...args),
  getRequestClientIp: () => getRequestClientIp(),
  clearSessionCookie: () => clearSessionCookie(),
}));

vi.mock("@/lib/auth/providers/local-provider", () => ({
  authenticateLocalUser: vi.fn(),
}));

vi.mock("@/lib/auth/session-bridge", () => ({
  establishSession: (...args: unknown[]) => establishSession(...args),
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    AUTH_LOGIN_SUCCESS: "auth.login.success",
    AUTH_LOGIN_FAILURE: "auth.login.failure",
    AUTH_LOGOUT: "auth.logout",
    AUTH_PASSWORD_CHANGED: "auth.password.changed",
  },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 0 })),
  resetRateLimit: vi.fn(),
}));

vi.mock("@/lib/security/request-context", () => ({
  getRequestSecurityContext: () => getRequestSecurityContext(),
}));

vi.mock("@/lib/security/login-history-service", () => ({
  recordFailedLogin: vi.fn(),
  recordSuccessfulLogin: vi.fn(),
}));

import { changePasswordAction } from "@/actions/auth";

const forcedSession = {
  id: "user-1",
  email: "new.hire@zebl.com",
  role: "employee" as const,
  employeeId: 5,
  employeeName: "New Hire",
  sessionVersion: 1,
  authProvider: "local" as const,
  mustChangePassword: true,
};

const voluntarySession = { ...forcedSession, mustChangePassword: false };

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validFields = {
  currentPassword: "OldPassword1",
  newPassword: "NewPassword1",
  confirmPassword: "NewPassword1",
};

describe("changePasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestClientIp.mockResolvedValue("127.0.0.1");
    getRequestSecurityContext.mockResolvedValue({ ipAddress: "127.0.0.1", userAgent: "test" });
    writeAuditLog.mockResolvedValue(undefined);
    clearSessionCookie.mockResolvedValue(undefined);
    invalidateUserSessions.mockResolvedValue(undefined);
    findUnique.mockResolvedValue({ password: "hashed-old" });
    update.mockResolvedValue({});
    bcryptCompare.mockResolvedValue(true);
    bcryptHash.mockResolvedValue("hashed-new");
  });

  it("rejects unauthenticated callers", async () => {
    getSession.mockResolvedValue(null);
    const result = await changePasswordAction({}, formData(validFields));
    expect(result).toEqual({ error: "Unauthorized." });
    expect(update).not.toHaveBeenCalled();
  });

  it("requires all fields", async () => {
    getSession.mockResolvedValue(voluntarySession);
    const result = await changePasswordAction(
      {},
      formData({ ...validFields, newPassword: "" })
    );
    expect(result.error).toMatch(/required/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation", async () => {
    getSession.mockResolvedValue(voluntarySession);
    const result = await changePasswordAction(
      {},
      formData({ ...validFields, confirmPassword: "Different1" })
    );
    expect(result.error).toMatch(/do not match/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects passwords shorter than 8 characters", async () => {
    getSession.mockResolvedValue(voluntarySession);
    const result = await changePasswordAction(
      {},
      formData({ currentPassword: "old", newPassword: "short1", confirmPassword: "short1" })
    );
    expect(result.error).toMatch(/at least 8/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("fails safely on an incorrect current password without touching auth state", async () => {
    getSession.mockResolvedValue(voluntarySession);
    bcryptCompare.mockResolvedValue(false);

    const result = await changePasswordAction({}, formData(validFields));

    expect(result).toEqual({ error: "Incorrect current password." });
    expect(update).not.toHaveBeenCalled();
    expect(invalidateUserSessions).not.toHaveBeenCalled();
    expect(establishSession).not.toHaveBeenCalled();
  });

  it("updates the password, clears mustChangePassword, and re-establishes a session", async () => {
    getSession.mockResolvedValue(voluntarySession);
    establishSession.mockResolvedValue({ ...voluntarySession, sessionId: "new-session" });

    const result = await changePasswordAction({}, formData(validFields));

    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "hashed-new", mustChangePassword: false },
    });
    expect(invalidateUserSessions).toHaveBeenCalledWith("user-1");
    expect(establishSession).toHaveBeenCalledWith({
      userId: "user-1",
      authProvider: "local",
      clientIp: "127.0.0.1",
    });
    expect(result).toEqual({ success: "Password changed successfully." });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to the role home after a mandatory first-login change", async () => {
    getSession.mockResolvedValue(forcedSession);
    establishSession.mockResolvedValue({
      ...forcedSession,
      mustChangePassword: false,
      sessionId: "new-session",
    });

    await expect(changePasswordAction({}, formData(validFields))).rejects.toThrow(
      "NEXT_REDIRECT:/employee/dashboard"
    );
    expect(update).toHaveBeenCalled();
    expect(establishSession).toHaveBeenCalled();
  });

  it("does not redirect a voluntary change from a settings page", async () => {
    getSession.mockResolvedValue(voluntarySession);
    establishSession.mockResolvedValue({ ...voluntarySession, sessionId: "new-session" });

    const result = await changePasswordAction({}, formData(validFields));
    expect(redirect).not.toHaveBeenCalled();
    expect(result.success).toBeTruthy();
  });

  it("fails safe to a clean login when the account cannot be re-authenticated", async () => {
    getSession.mockResolvedValue(forcedSession);
    establishSession.mockResolvedValue(null);

    await expect(changePasswordAction({}, formData(validFields))).rejects.toThrow(
      "NEXT_REDIRECT:/login?clear=1"
    );
    expect(clearSessionCookie).toHaveBeenCalled();
  });

  it("does not clear mustChangePassword or invalidate sessions when the DB update throws", async () => {
    getSession.mockResolvedValue(forcedSession);
    update.mockRejectedValue(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await changePasswordAction({}, formData(validFields));

    expect(result.error).toMatch(/error occurred/i);
    expect(invalidateUserSessions).not.toHaveBeenCalled();
    expect(establishSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
