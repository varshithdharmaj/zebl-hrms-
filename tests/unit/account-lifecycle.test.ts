import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountStatus } from "@/generated/prisma/client";

const userCount = vi.fn();
const userUpdate = vi.fn();
const employeeUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      count: (...args: unknown[]) => userCount(...args),
    },
  },
}));

import {
  AccountLifecycleError,
  applyEmployeeFieldsFromAccountStatus,
  applyEmployeeFieldsFromUserActive,
  applyUserFieldsFromEmployeeStatus,
  assertLastSuperAdminDeactivationAllowed,
  employeeStatusToUserAccountFields,
  generateSecureTemporaryPassword,
  userAccountStatusToEmployeeFields,
} from "@/lib/admin/account-lifecycle";

describe("employeeStatusToUserAccountFields mapping", () => {
  it("maps Active → active/usable login", () => {
    expect(employeeStatusToUserAccountFields("Active")).toEqual({
      accountStatus: AccountStatus.active,
      isActive: true,
    });
  });

  it("maps Terminated → terminated/unusable login", () => {
    expect(employeeStatusToUserAccountFields("Terminated")).toEqual({
      accountStatus: AccountStatus.terminated,
      isActive: false,
    });
  });

  it("maps Inactive and Resigned → inactive/unusable login", () => {
    expect(employeeStatusToUserAccountFields("Inactive")).toEqual({
      accountStatus: AccountStatus.inactive,
      isActive: false,
    });
    expect(employeeStatusToUserAccountFields("Resigned")).toEqual({
      accountStatus: AccountStatus.inactive,
      isActive: false,
    });
  });
});

describe("userAccountStatusToEmployeeFields mapping", () => {
  it("maps active/inactive/terminated", () => {
    expect(userAccountStatusToEmployeeFields(AccountStatus.active)).toEqual({
      employeeStatus: "Active",
      isActive: true,
    });
    expect(userAccountStatusToEmployeeFields(AccountStatus.inactive)).toEqual({
      employeeStatus: "Inactive",
      isActive: false,
    });
    expect(userAccountStatusToEmployeeFields(AccountStatus.terminated)).toEqual({
      employeeStatus: "Terminated",
      isActive: false,
    });
  });

  it("does not rewrite employee for lock/suspend/pending", () => {
    expect(userAccountStatusToEmployeeFields(AccountStatus.locked)).toBeNull();
    expect(userAccountStatusToEmployeeFields(AccountStatus.suspended)).toBeNull();
    expect(userAccountStatusToEmployeeFields(AccountStatus.pending)).toBeNull();
  });
});

describe("generateSecureTemporaryPassword", () => {
  it("never returns the weak default 123", () => {
    for (let i = 0; i < 20; i++) {
      const pw = generateSecureTemporaryPassword();
      expect(pw).not.toBe("123");
      expect(pw.length).toBeGreaterThanOrEqual(8);
      expect(pw.startsWith("Zb-")).toBe(true);
    }
  });
});

describe("assertLastSuperAdminDeactivationAllowed", () => {
  beforeEach(() => {
    userCount.mockReset();
  });

  it("allows non-superadmin targets", async () => {
    await assertLastSuperAdminDeactivationAllowed(
      { user: { count: userCount } } as never,
      {
        targetUserId: "u1",
        targetRole: "hr",
        makingUnavailable: true,
      }
    );
    expect(userCount).not.toHaveBeenCalled();
  });

  it("blocks last active Superadmin deactivation", async () => {
    userCount.mockResolvedValue(0);
    await expect(
      assertLastSuperAdminDeactivationAllowed(
        { user: { count: userCount } } as never,
        {
          targetUserId: "sa-1",
          targetRole: "super_admin",
          makingUnavailable: true,
        }
      )
    ).rejects.toThrow(AccountLifecycleError);
  });

  it("allows Superadmin deactivation when another remains", async () => {
    userCount.mockResolvedValue(1);
    await assertLastSuperAdminDeactivationAllowed(
      { user: { count: userCount } } as never,
      {
        targetUserId: "sa-1",
        targetRole: "super_admin",
        makingUnavailable: true,
      }
    );
  });
});

describe("apply sync helpers", () => {
  beforeEach(() => {
    userUpdate.mockReset();
    employeeUpdate.mockReset();
  });

  it("applies employee status onto user", async () => {
    const tx = { user: { update: userUpdate } } as never;
    await applyUserFieldsFromEmployeeStatus(tx, "user-1", "Inactive");
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { accountStatus: AccountStatus.inactive, isActive: false },
    });
  });

  it("applies user active flag onto employee", async () => {
    const tx = { employee: { update: employeeUpdate } } as never;
    await applyEmployeeFieldsFromUserActive(tx, 9, false);
    expect(employeeUpdate).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { employeeStatus: "Inactive", isActive: false },
    });
  });

  it("skips employee rewrite for locked account status", async () => {
    const tx = { employee: { update: employeeUpdate } } as never;
    const result = await applyEmployeeFieldsFromAccountStatus(
      tx,
      9,
      AccountStatus.locked
    );
    expect(result).toBeNull();
    expect(employeeUpdate).not.toHaveBeenCalled();
  });
});
