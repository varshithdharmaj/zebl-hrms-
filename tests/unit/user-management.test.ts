import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/session";

const findUnique = vi.fn();
const update = vi.fn();
const count = vi.fn();
const findFirst = vi.fn();
const employeeUpdate = vi.fn();
const writeAuditLog = vi.fn();
const invalidateUserSessions = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
      count: (...args: unknown[]) => count(...args),
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        user: {
          findUnique: (...args: unknown[]) => findUnique(...args),
          update: (...args: unknown[]) => update(...args),
          count: (...args: unknown[]) => count(...args),
        },
        employee: {
          update: (...args: unknown[]) => employeeUpdate(...args),
        },
      }),
  },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    USER_ROLE_CHANGED: "user.role.changed",
    USER_ACTIVATED: "user.activated",
    USER_DEACTIVATED: "user.deactivated",
    SUPER_ADMIN_CREATED: "user.super_admin.created",
    AUTH_PASSWORD_RESET: "auth.password.reset",
    USER_ACCOUNT_LOCKED: "user.account.locked",
    USER_ACCOUNT_UNLOCKED: "user.account.unlocked",
    USER_ACCOUNT_STATUS_CHANGED: "user.account_status.changed",
    USER_IDENTITY_UPDATED: "user.identity.updated",
  },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

vi.mock("@/lib/auth", () => ({
  invalidateUserSessions: (...args: unknown[]) => invalidateUserSessions(...args),
}));

import {
  changeUserRole,
  resetUserPassword,
  setUserActive,
  updateUserAccountStatus,
  UserManagementError,
} from "@/lib/admin/user-management";
import { AccountStatus } from "@prisma/client";

const superAdminActor: SessionUser = {
  id: "actor-1",
  email: "actor@test.local",
  role: "super_admin",
  employeeId: null,
  employeeName: null,
  sessionVersion: 1,
  authProvider: "local",
};

const hrActor: SessionUser = {
  ...superAdminActor,
  id: "actor-2",
  role: "hr",
};

describe("changeUserRole — privilege escalation & last-admin protection", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    count.mockReset();
    findFirst.mockReset();
    employeeUpdate.mockReset();
    writeAuditLog.mockReset();
    invalidateUserSessions.mockReset();
  });

  it("blocks HR from changing anyone's role", async () => {
    await expect(changeUserRole(hrActor, "target-1", "hr")).rejects.toThrow(UserManagementError);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("blocks a Super Admin from changing their own role", async () => {
    await expect(
      changeUserRole(superAdminActor, superAdminActor.id, "hr")
    ).rejects.toThrow(/own role/);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("blocks demoting the last active Super Admin", async () => {
    findUnique.mockResolvedValue({ id: "target-1", role: "super_admin", isActive: true });
    count.mockResolvedValue(0); // no other active super admins besides the target

    await expect(changeUserRole(superAdminActor, "target-1", "hr")).rejects.toThrow(
      /last active Super Admin/
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("allows demoting a Super Admin when another active Super Admin remains", async () => {
    findUnique.mockResolvedValue({ id: "target-1", role: "super_admin", isActive: true });
    count.mockResolvedValue(1); // another active super admin exists
    update.mockResolvedValue({});

    await changeUserRole(superAdminActor, "target-1", "hr");

    expect(update).toHaveBeenCalledWith({
      where: { id: "target-1" },
      data: { role: "hr" },
    });
    expect(writeAuditLog).toHaveBeenCalled();
    expect(invalidateUserSessions).toHaveBeenCalledWith("target-1");
  });

  it("allows promoting HR to Super Admin without a last-admin check", async () => {
    findUnique.mockResolvedValue({ id: "target-2", role: "hr", isActive: true });
    update.mockResolvedValue({});

    await changeUserRole(superAdminActor, "target-2", "super_admin");

    expect(count).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: "target-2" },
      data: { role: "super_admin" },
    });
  });
});

describe("employee account administration", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    count.mockReset();
    findFirst.mockReset();
    employeeUpdate.mockReset();
    writeAuditLog.mockReset();
    invalidateUserSessions.mockReset();
  });

  it("allows HR to reset an employee password and revokes sessions", async () => {
    findUnique.mockResolvedValue({
      id: "employee-user",
      email: "employee@test.local",
      role: "employee",
      employeeId: 12,
      employee: { id: 12 },
      mustChangePassword: false,
    });
    await resetUserPassword(hrActor, {
      userId: "employee-user",
      password: "NewPassword123",
      generate: false,
      mustChangePassword: true,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "employee-user" },
      data: expect.objectContaining({
        password: expect.any(String),
        mustChangePassword: true,
      }),
    });
    expect(invalidateUserSessions).toHaveBeenCalledWith("employee-user");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.password.reset" }),
      expect.anything()
    );
  });

  it("prevents HR from resetting a Super Admin password", async () => {
    findUnique.mockResolvedValue({
      id: "protected-user",
      role: "super_admin",
      employeeId: null,
      employee: null,
    });
    await expect(
      resetUserPassword(hrActor, {
        userId: "protected-user",
        password: "NewPassword123",
        generate: false,
        mustChangePassword: true,
      })
    ).rejects.toThrow(/not permitted/);
    expect(update).not.toHaveBeenCalled();
  });

  it("does not create local credentials for Microsoft-managed accounts", async () => {
    findUnique.mockResolvedValue({
      id: "microsoft-user",
      role: "employee",
      employeeId: 12,
      employee: { id: 12 },
      authProvider: "microsoft",
    });
    await expect(
      resetUserPassword(hrActor, {
        userId: "microsoft-user",
        password: "NewPassword123",
        generate: false,
        mustChangePassword: true,
      })
    ).rejects.toThrow(/managed by Microsoft/);
    expect(update).not.toHaveBeenCalled();
  });

  it("allows HR to lock an employee and records the change", async () => {
    findUnique.mockResolvedValue({
      id: "employee-user",
      role: "employee",
      employeeId: 12,
      employee: { id: 12 },
      accountStatus: AccountStatus.active,
      isActive: true,
    });
    await updateUserAccountStatus(
      hrActor,
      "employee-user",
      AccountStatus.locked,
      "Security review"
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "employee-user" },
      data: expect.objectContaining({
        accountStatus: AccountStatus.locked,
        isActive: false,
        lockedAt: expect.any(Date),
      }),
    });
    expect(invalidateUserSessions).toHaveBeenCalledWith("employee-user");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.account.locked",
        oldValue: expect.any(Object),
        newValue: expect.any(Object),
      }),
      expect.anything()
    );
  });
});

describe("setUserActive — privilege escalation & last-admin protection", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    count.mockReset();
    writeAuditLog.mockReset();
    invalidateUserSessions.mockReset();
  });

  it("blocks HR from activating/deactivating anyone", async () => {
    await expect(setUserActive(hrActor, "target-1", false)).rejects.toThrow(UserManagementError);
  });

  it("blocks self-deactivation", async () => {
    await expect(
      setUserActive(superAdminActor, superAdminActor.id, false)
    ).rejects.toThrow(/own account/);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("blocks deactivating the last active Super Admin", async () => {
    findUnique.mockResolvedValue({ id: "target-1", role: "super_admin", isActive: true });
    count.mockResolvedValue(0);

    await expect(setUserActive(superAdminActor, "target-1", false)).rejects.toThrow(
      /last active Super Admin/
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("allows deactivating a Super Admin when another active Super Admin remains", async () => {
    findUnique.mockResolvedValue({ id: "target-1", role: "super_admin", isActive: true });
    count.mockResolvedValue(1);
    update.mockResolvedValue({});

    await setUserActive(superAdminActor, "target-1", false);

    expect(update).toHaveBeenCalledWith({
      where: { id: "target-1" },
      data: expect.objectContaining({ isActive: false, accountStatus: "inactive" }),
    });
    expect(invalidateUserSessions).toHaveBeenCalledWith("target-1");
  });

  it("allows deactivating a non-admin without a last-admin check", async () => {
    findUnique.mockResolvedValue({ id: "target-3", role: "employee", isActive: true });
    update.mockResolvedValue({});

    await setUserActive(superAdminActor, "target-3", false);

    expect(count).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: "target-3" },
      data: expect.objectContaining({ isActive: false, accountStatus: "inactive" }),
    });
  });
});
