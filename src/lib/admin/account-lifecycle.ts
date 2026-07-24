import type { Prisma } from "@/generated/prisma/client";
import { AccountStatus, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { AppUserRole } from "@/lib/roles";
import type { EmployeeStatus } from "@/lib/employee-types";
import { statusToIsActive } from "@/lib/employee-types";

/**
 * Intended User ↔ Employee status mapping (derived from existing mutations):
 *
 * Employee → User
 *   Active     → accountStatus=active,     isActive=true
 *   Terminated → accountStatus=terminated, isActive=false
 *   Inactive   → accountStatus=inactive,   isActive=false
 *   Resigned   → accountStatus=inactive,   isActive=false
 *
 * User accountStatus → Employee (only for these statuses)
 *   active     → employeeStatus=Active,     isActive=true
 *   terminated → employeeStatus=Terminated, isActive=false
 *   inactive   → employeeStatus=Inactive,   isActive=false
 *   locked / suspended / pending → update User only; do not rewrite Employee HR status
 *
 * Login gates (local-provider, session-bridge) require:
 *   user.isActive === true AND (no employee OR employee Active+isActive)
 */

export type UserAccountFields = {
  accountStatus: AccountStatus;
  isActive: boolean;
};

export type EmployeeStatusFields = {
  employeeStatus: EmployeeStatus;
  isActive: boolean;
};

export function employeeStatusToUserAccountFields(
  employeeStatus: string
): UserAccountFields {
  if (employeeStatus === "Active") {
    return { accountStatus: AccountStatus.active, isActive: true };
  }
  if (employeeStatus === "Terminated") {
    return { accountStatus: AccountStatus.terminated, isActive: false };
  }
  return { accountStatus: AccountStatus.inactive, isActive: false };
}

export function userAccountStatusToEmployeeFields(
  status: AccountStatus
): EmployeeStatusFields | null {
  if (status === AccountStatus.active) {
    return { employeeStatus: "Active", isActive: true };
  }
  if (status === AccountStatus.terminated) {
    return { employeeStatus: "Terminated", isActive: false };
  }
  if (status === AccountStatus.inactive) {
    return { employeeStatus: "Inactive", isActive: false };
  }
  // locked / suspended / pending — account-level only
  return null;
}

export function userActiveFlagToEmployeeFields(isActive: boolean): EmployeeStatusFields {
  return isActive
    ? { employeeStatus: "Active", isActive: true }
    : { employeeStatus: "Inactive", isActive: false };
}

export class AccountLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountLifecycleError";
  }
}

type Tx = Prisma.TransactionClient | typeof prisma;

/** Active Super Admin count, optionally excluding one user (for pre-mutation checks). */
export async function countActiveSuperAdmins(
  tx: Tx = prisma,
  excludeUserId?: string
): Promise<number> {
  return tx.user.count({
    where: {
      role: UserRole.super_admin,
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

/**
 * Blocks deactivating/disabling the last active Superadmin.
 * Call when making a Superadmin unavailable (isActive=false or non-active accountStatus).
 */
export async function assertLastSuperAdminDeactivationAllowed(
  tx: Tx,
  params: {
    targetUserId: string;
    targetRole: AppUserRole;
    makingUnavailable: boolean;
  }
): Promise<void> {
  if (!params.makingUnavailable || params.targetRole !== "super_admin") return;
  const remaining = await countActiveSuperAdmins(tx, params.targetUserId);
  if (remaining === 0) {
    throw new AccountLifecycleError(
      "Cannot deactivate the last active Super Admin. Promote another user first."
    );
  }
}

/** Apply employee status onto a linked user row (inside an existing transaction). */
export async function applyUserFieldsFromEmployeeStatus(
  tx: Prisma.TransactionClient,
  userId: string,
  employeeStatus: string
): Promise<UserAccountFields> {
  const fields = employeeStatusToUserAccountFields(employeeStatus);
  await tx.user.update({
    where: { id: userId },
    data: {
      accountStatus: fields.accountStatus,
      isActive: fields.isActive,
    },
  });
  return fields;
}

/** Apply binary user active flag onto a linked employee row. */
export async function applyEmployeeFieldsFromUserActive(
  tx: Prisma.TransactionClient,
  employeeId: number,
  isActive: boolean
): Promise<EmployeeStatusFields> {
  const fields = userActiveFlagToEmployeeFields(isActive);
  await tx.employee.update({
    where: { id: employeeId },
    data: {
      employeeStatus: fields.employeeStatus,
      isActive: fields.isActive,
    },
  });
  return fields;
}

/** Apply accountStatus onto linked employee when mapping is defined. */
export async function applyEmployeeFieldsFromAccountStatus(
  tx: Prisma.TransactionClient,
  employeeId: number,
  status: AccountStatus
): Promise<EmployeeStatusFields | null> {
  const fields = userAccountStatusToEmployeeFields(status);
  if (!fields) return null;
  await tx.employee.update({
    where: { id: employeeId },
    data: {
      employeeStatus: fields.employeeStatus,
      isActive: fields.isActive,
    },
  });
  return fields;
}

/** Secure temporary password for local credential provisioning (not logged). */
export function generateSecureTemporaryPassword(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const str = Array.from(bytes, (b) => b.toString(36)).join("").slice(0, 9);
  return `Zb-${str}9a!`;
}

export { statusToIsActive };
