import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  PasswordChangeRequiredError,
  assertPasswordChangeComplete,
  sessionRequiresPasswordChange,
} from "@/lib/auth/password-change-gate";
import type { SessionUser } from "@/lib/session";

const localMustChange: SessionUser = {
  id: "u1",
  email: "emp@zebl.com",
  role: "employee",
  employeeId: 1,
  employeeName: "Emp",
  sessionVersion: 1,
  authProvider: "local",
  mustChangePassword: true,
};

const localOk: SessionUser = {
  ...localMustChange,
  mustChangePassword: false,
};

const ssoMustChange: SessionUser = {
  ...localMustChange,
  authProvider: "microsoft",
};

describe("mustChangePassword gate", () => {
  it("requires a password change for local accounts with the flag", () => {
    expect(sessionRequiresPasswordChange(localMustChange)).toBe(true);
    expect(() => assertPasswordChangeComplete(localMustChange)).toThrow(
      PasswordChangeRequiredError
    );
  });

  it("does not block local accounts after the flag is cleared", () => {
    expect(sessionRequiresPasswordChange(localOk)).toBe(false);
    expect(() => assertPasswordChangeComplete(localOk)).not.toThrow();
  });

  it("does not block SSO users even if mustChangePassword is set", () => {
    expect(sessionRequiresPasswordChange(ssoMustChange)).toBe(false);
    expect(() => assertPasswordChangeComplete(ssoMustChange)).not.toThrow();
  });
});

describe("getSessionOrThrow password gate", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows a normal local session", async () => {
    vi.doMock("@/lib/auth", () => ({
      getSession: vi.fn(async () => localOk),
    }));
    const { getSessionOrThrow } = await import("@/lib/auth-guards");
    await expect(getSessionOrThrow()).resolves.toMatchObject({ id: "u1" });
  });

  it("blocks a local session that must change password", async () => {
    vi.doMock("@/lib/auth", () => ({
      getSession: vi.fn(async () => localMustChange),
    }));
    const { getSessionOrThrow } = await import("@/lib/auth-guards");
    await expect(getSessionOrThrow()).rejects.toMatchObject({
      name: "PasswordChangeRequiredError",
      message: "Password change required",
    });
  });

  it("getSessionAllowingPasswordChange still returns the session", async () => {
    vi.doMock("@/lib/auth", () => ({
      getSession: vi.fn(async () => localMustChange),
    }));
    const { getSessionAllowingPasswordChange } = await import("@/lib/auth-guards");
    await expect(getSessionAllowingPasswordChange()).resolves.toMatchObject({
      mustChangePassword: true,
    });
  });
});
