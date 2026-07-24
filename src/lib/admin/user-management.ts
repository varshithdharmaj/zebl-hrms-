import type { Prisma } from "@/generated/prisma/client";
import { AccountStatus, AuthProvider, UserRole } from "@/generated/prisma/enums";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { invalidateUserSessions } from "@/lib/auth";
import {
  AccountLifecycleError,
  applyEmployeeFieldsFromAccountStatus,
  applyEmployeeFieldsFromUserActive,
  assertLastSuperAdminDeactivationAllowed,
  countActiveSuperAdmins,
  employeeStatusToUserAccountFields,
  generateSecureTemporaryPassword,
} from "@/lib/admin/account-lifecycle";
import {
  canAdministerEmployeeAccount,
  canManageUserRoles,
  canModifyTargetUser,
} from "@/lib/permissions";
import { isAppUserRole, toAppUserRole, type AppUserRole } from "@/lib/roles";
import type { SessionUser } from "@/lib/session";
import { getRequestSecurityContext } from "@/lib/security/request-context";

export class UserManagementError extends Error {}

export { countActiveSuperAdmins };

export type AdminUserListItem = {
  id: string;
  email: string;
  role: AppUserRole;
  isActive: boolean;
  authProvider: string;
  employeeId: number | null;
  employeeName: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export type ListUsersFilters = {
  q?: string;
  role?: AppUserRole;
  status?: "active" | "inactive";
  page?: number;
  pageSize?: number;
};

export async function listUsers(
  filters: ListUsersFilters
): Promise<{ users: AdminUserListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

  const where: Prisma.UserWhereInput = {
    ...(filters.q
      ? {
          OR: [
            { email: { contains: filters.q, mode: "insensitive" as const } },
            { employee: { name: { contains: filters.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { isActive: filters.status === "active" } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { employee: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: toAppUserRole(u.role),
      isActive: u.isActive,
      authProvider: u.authProvider,
      employeeId: u.employeeId,
      employeeName: u.employee?.name ?? null,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
    total,
    page,
    pageSize,
  };
}

function requireValidRole(role: string): AppUserRole {
  if (!isAppUserRole(role)) throw new UserManagementError("Invalid role.");
  return role;
}

export async function changeUserRole(
  actor: SessionUser,
  targetUserId: string,
  newRoleInput: string
): Promise<void> {
  if (!canManageUserRoles(actor.role)) {
    throw new UserManagementError("Only Super Admin may change user roles.");
  }
  if (targetUserId === actor.id) {
    throw new UserManagementError(
      "You cannot change your own role. Ask another Super Admin to do this."
    );
  }

  const newRole = requireValidRole(newRoleInput);
  const requestContext = await getRequestSecurityContext();

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new UserManagementError("User not found.");

    const previousRole = toAppUserRole(target.role);
    if (!canModifyTargetUser(actor.role, previousRole)) {
      throw new UserManagementError("You are not permitted to modify this user.");
    }
    if (previousRole === newRole) return;

    // Never allow the last active Super Admin to be demoted.
    if (previousRole === "super_admin" && target.isActive) {
      const remaining = await countActiveSuperAdmins(tx, target.id);
      if (remaining === 0) {
        throw new UserManagementError(
          "Cannot demote the last active Super Admin. Promote another user first."
        );
      }
    }

    await tx.user.update({ where: { id: targetUserId }, data: { role: newRole as UserRole } });

    await writeAuditLog(
      {
        entityType: "user",
        entityId: targetUserId,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        actorUserId: actor.id,
        actorEmail: actor.email,
        employeeId: target.employeeId,
        module: "employees",
        description: "User role was changed.",
        oldValue: { role: previousRole },
        newValue: { role: newRole },
        requestContext,
        metadata: { previousRole, newRole },
      },
      tx
    );
  });

  // Role changes take effect immediately: invalidate the target's existing sessions.
  await invalidateUserSessions(targetUserId);
}

export async function setUserActive(
  actor: SessionUser,
  targetUserId: string,
  isActive: boolean
): Promise<void> {
  if (!canManageUserRoles(actor.role)) {
    throw new UserManagementError("Only Super Admin may activate or deactivate users.");
  }
  if (targetUserId === actor.id) {
    throw new UserManagementError(
      isActive
        ? "You cannot reactivate your own account."
        : "You cannot deactivate your own account. Ask another Super Admin to do this."
    );
  }
  const requestContext = await getRequestSecurityContext();

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new UserManagementError("User not found.");

    const targetRole = toAppUserRole(target.role);
    if (!canModifyTargetUser(actor.role, targetRole)) {
      throw new UserManagementError("You are not permitted to modify this user.");
    }
    if (target.isActive === isActive) return;

    try {
      await assertLastSuperAdminDeactivationAllowed(tx, {
        targetUserId: target.id,
        targetRole,
        makingUnavailable: !isActive,
      });
    } catch (error) {
      if (error instanceof AccountLifecycleError) {
        throw new UserManagementError(error.message);
      }
      throw error;
    }

    const accountStatus = isActive ? AccountStatus.active : AccountStatus.inactive;
    await tx.user.update({
      where: { id: targetUserId },
      data: {
        isActive,
        accountStatus,
        lockedAt: null,
        lockedReason: null,
      },
    });

    if (target.employeeId) {
      await applyEmployeeFieldsFromUserActive(tx, target.employeeId, isActive);
    }

    await writeAuditLog(
      {
        entityType: "user",
        entityId: targetUserId,
        action: isActive ? AUDIT_ACTIONS.USER_ACTIVATED : AUDIT_ACTIONS.USER_DEACTIVATED,
        actorUserId: actor.id,
        actorEmail: actor.email,
        employeeId: target.employeeId,
        module: "employees",
        description: isActive ? "User account was activated." : "User account was deactivated.",
        oldValue: { isActive: target.isActive, accountStatus: target.accountStatus },
        newValue: {
          isActive,
          accountStatus,
        },
        requestContext,
        metadata: { role: targetRole, employeeSynced: Boolean(target.employeeId) },
      },
      tx
    );
  });

  // Deactivation takes effect immediately: invalidate the target's existing sessions.
  if (!isActive) {
    await invalidateUserSessions(targetUserId);
  }
}

async function getAccountTarget(userId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true },
  });
  if (!target) throw new UserManagementError("User not found.");
  return target;
}

function assertAccountAccess(
  actor: SessionUser,
  target: Awaited<ReturnType<typeof getAccountTarget>>,
  destructive = false
): void {
  const targetRole = toAppUserRole(target.role);
  if (!canAdministerEmployeeAccount(actor.role, targetRole)) {
    throw new UserManagementError("You are not permitted to administer this account.");
  }
  if (destructive && actor.id === target.id) {
    throw new UserManagementError("You cannot lock, deactivate, or terminate your own account.");
  }
}

export async function resetUserPassword(
  actor: SessionUser,
  input: {
    userId: string;
    password?: string;
    generate: boolean;
    mustChangePassword: boolean;
  }
): Promise<{ temporaryPassword?: string }> {
  const target = await getAccountTarget(input.userId);
  assertAccountAccess(actor, target);
  if (target.authProvider === "microsoft") {
    throw new UserManagementError(
      "This account is managed by Microsoft. Reset its password through the identity provider."
    );
  }

  const password = input.generate ? generateSecureTemporaryPassword() : input.password ?? "";
  if (password.length < 8) {
    throw new UserManagementError("Password must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const requestContext = await getRequestSecurityContext();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: {
        password: passwordHash,
        mustChangePassword: input.mustChangePassword,
      },
    });
    await writeAuditLog({
      entityType: "user",
      entityId: target.id,
      action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET,
      actorUserId: actor.id,
      actorEmail: actor.email,
      employeeId: target.employeeId,
      module: "authentication",
      description: "An administrator reset the user's password.",
      oldValue: { mustChangePassword: target.mustChangePassword },
      newValue: { mustChangePassword: input.mustChangePassword },
      requestContext,
      metadata: { generated: input.generate },
    }, tx);
  });
  await invalidateUserSessions(target.id);
  return input.generate ? { temporaryPassword: password } : {};
}

export async function updateUserAccountStatus(
  actor: SessionUser,
  userId: string,
  status: AccountStatus,
  reason?: string
): Promise<void> {
  const target = await getAccountTarget(userId);
  const destructive = status !== AccountStatus.active && status !== AccountStatus.pending;
  assertAccountAccess(actor, target, destructive);

  const targetRole = toAppUserRole(target.role);
  const isActive = status === AccountStatus.active;
  try {
    await assertLastSuperAdminDeactivationAllowed(prisma, {
      targetUserId: target.id,
      targetRole,
      makingUnavailable: !isActive,
    });
  } catch (error) {
    if (error instanceof AccountLifecycleError) {
      throw new UserManagementError(error.message);
    }
    throw error;
  }

  const requestContext = await getRequestSecurityContext();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: {
        accountStatus: status,
        isActive,
        lockedAt: status === AccountStatus.locked ? new Date() : null,
        lockedReason: status === AccountStatus.locked ? reason || null : null,
      },
    });
    if (target.employeeId) {
      await applyEmployeeFieldsFromAccountStatus(tx, target.employeeId, status);
    }
    const action =
      status === AccountStatus.locked
        ? AUDIT_ACTIONS.USER_ACCOUNT_LOCKED
        : target.accountStatus === AccountStatus.locked && status === AccountStatus.active
          ? AUDIT_ACTIONS.USER_ACCOUNT_UNLOCKED
          : AUDIT_ACTIONS.USER_ACCOUNT_STATUS_CHANGED;
    await writeAuditLog({
      entityType: "user",
      entityId: target.id,
      action,
      actorUserId: actor.id,
      actorEmail: actor.email,
      employeeId: target.employeeId,
      module: "employees",
      description: `Account status changed to ${status}.`,
      oldValue: { accountStatus: target.accountStatus, isActive: target.isActive },
      newValue: { accountStatus: status, isActive },
      requestContext,
      metadata: { reason: reason || null },
    }, tx);
  });
  if (!isActive) await invalidateUserSessions(target.id);
}

export async function updateUserIdentity(
  actor: SessionUser,
  input: {
    userId: string;
    username: string | null;
    email: string;
    profilePhotoUrl: string | null;
  }
): Promise<void> {
  const target = await getAccountTarget(input.userId);
  assertAccountAccess(actor, target);
  const email = input.email.toLowerCase();

  const duplicate = await prisma.user.findFirst({
    where: {
      id: { not: target.id },
      OR: [
        { email },
        ...(input.username ? [{ username: input.username }] : []),
      ],
    },
    select: { id: true },
  });
  if (duplicate) throw new UserManagementError("Email or username is already in use.");

  const requestContext = await getRequestSecurityContext();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: {
        email,
        username: input.username,
        profilePhotoUrl: input.profilePhotoUrl,
      },
    });
    if (target.employeeId) {
      await tx.employee.update({
        where: { id: target.employeeId },
        data: { email },
      });
    }
    await writeAuditLog({
      entityType: "user",
      entityId: target.id,
      action: AUDIT_ACTIONS.USER_IDENTITY_UPDATED,
      actorUserId: actor.id,
      actorEmail: actor.email,
      employeeId: target.employeeId,
      module: "employees",
      description: "Account identity information was updated.",
      oldValue: {
        email: target.email,
        username: target.username,
        profilePhotoUrl: target.profilePhotoUrl,
      },
      newValue: input,
      requestContext,
    }, tx);
    if (target.profilePhotoUrl !== input.profilePhotoUrl) {
      await writeAuditLog({
        entityType: "user",
        entityId: target.id,
        action: AUDIT_ACTIONS.USER_PROFILE_PHOTO_CHANGED,
        actorUserId: actor.id,
        actorEmail: actor.email,
        employeeId: target.employeeId,
        module: "employees",
        description: "Profile photo was changed.",
        oldValue: { profilePhotoUrl: target.profilePhotoUrl },
        newValue: { profilePhotoUrl: input.profilePhotoUrl },
        requestContext,
      }, tx);
    }
  });
}

/**
 * Create a new local login for an employee who has none, or link an existing
 * unlinked employee-role user. Role is always forced to `employee` on create.
 * HR cannot create/link HR or Superadmin accounts.
 */
/**
 * Canonical local employee-login provisioning contract.
 * All admin paths that create/link employee-role logins should call this
 * (create-employee, account tab, attendance upload). SSO / password-reset stay separate.
 */
export async function provisionEmployeeLogin(
  actor: SessionUser,
  input: {
    employeeId: number;
    mode: "create" | "link";
    email?: string;
    existingUserId?: string;
    password?: string;
    generate: boolean;
    mustChangePassword: boolean;
    /** Audit metadata.operation — defaults to mode name */
    auditOperation?: string;
  }
): Promise<{ userId: string; temporaryPassword?: string }> {
  if (!canAdministerEmployeeAccount(actor.role, "employee")) {
    // HR and Superadmin both pass for target role "employee"; employees do not.
    throw new UserManagementError("You are not permitted to provision employee logins.");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    include: { user: true },
  });
  if (!employee) throw new UserManagementError("Employee not found.");
  if (employee.user) {
    throw new UserManagementError("This employee already has a linked login account.");
  }

  const requestContext = await getRequestSecurityContext();

  if (input.mode === "link") {
    const email = input.email?.trim().toLowerCase() || null;
    const existing = input.existingUserId
      ? await prisma.user.findUnique({ where: { id: input.existingUserId } })
      : email
        ? await prisma.user.findUnique({ where: { email } })
        : null;

    if (!existing) throw new UserManagementError("No matching login account found to link.");
    if (existing.employeeId) {
      throw new UserManagementError("That login is already linked to another employee.");
    }

    const existingRole = toAppUserRole(existing.role);
    // HR may only link employee-role accounts; Superadmin may link employee-role only
    // through this employee-provisioning path (role changes stay on the SA control plane).
    if (existingRole !== "employee") {
      throw new UserManagementError(
        "Only employee-role logins can be linked through employee account provisioning."
      );
    }
    if (!canAdministerEmployeeAccount(actor.role, existingRole)) {
      throw new UserManagementError("You are not permitted to link this account.");
    }

    const linkedAccount = employeeStatusToUserAccountFields(employee.employeeStatus);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          employeeId: employee.id,
          accountStatus: linkedAccount.accountStatus,
          isActive: linkedAccount.isActive,
          ...(employee.email ? {} : { email: existing.email }),
        },
      });
      if (!employee.email) {
        await tx.employee.update({
          where: { id: employee.id },
          data: { email: existing.email },
        });
      }
      await writeAuditLog(
        {
          entityType: "user",
          entityId: existing.id,
          action: AUDIT_ACTIONS.USER_LOGIN_LINKED,
          actorUserId: actor.id,
          actorEmail: actor.email,
          employeeId: employee.id,
          module: "employees",
          description: "An existing login was linked to an employee record.",
          newValue: {
            employeeId: employee.id,
            email: existing.email,
            role: existingRole,
            accountStatus: linkedAccount.accountStatus,
            isActive: linkedAccount.isActive,
          },
          requestContext,
          metadata: {
            operation: input.auditOperation ?? "link",
            employeeCode: employee.employeeCode,
          },
        },
        tx
      );
    });

    if (!linkedAccount.isActive) {
      await invalidateUserSessions(existing.id);
    }

    return { userId: existing.id };
  }

  // create mode — role forced to employee; never trust client role
  const email = (input.email ?? employee.email ?? "").trim().toLowerCase();
  if (!email) throw new UserManagementError("Email is required to create a login.");

  const duplicate = await prisma.user.findUnique({ where: { email } });
  if (duplicate) {
    throw new UserManagementError(
      "A login with this email already exists. Use link mode to attach an unlinked employee login."
    );
  }

  const password = input.generate ? generateSecureTemporaryPassword() : input.password ?? "";
  if (password.length < 8) {
    throw new UserManagementError("Password must be at least 8 characters.");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const accountFields = employeeStatusToUserAccountFields(employee.employeeStatus);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: passwordHash,
        role: UserRole.employee,
        employeeId: employee.id,
        accountStatus: accountFields.accountStatus,
        isActive: accountFields.isActive,
        mustChangePassword: input.mustChangePassword,
        authProvider: AuthProvider.local,
      },
    });
    if (!employee.email) {
      await tx.employee.update({
        where: { id: employee.id },
        data: { email },
      });
    }
    await writeAuditLog(
      {
        entityType: "user",
        entityId: user.id,
        action: AUDIT_ACTIONS.USER_LOGIN_CREATED,
        actorUserId: actor.id,
        actorEmail: actor.email,
        employeeId: employee.id,
        module: "employees",
        description: "A local employee login was provisioned.",
        newValue: {
          email,
          role: "employee",
          employeeId: employee.id,
          mustChangePassword: input.mustChangePassword,
          accountStatus: accountFields.accountStatus,
          isActive: accountFields.isActive,
        },
        requestContext,
        metadata: {
          operation: input.auditOperation ?? "create",
          employeeCode: employee.employeeCode,
          generated: input.generate,
          employeeStatus: employee.employeeStatus,
        },
      },
      tx
    );
    return user;
  });

  return {
    userId: created.id,
    temporaryPassword: input.generate ? password : undefined,
  };
}

/**
 * Idempotent Super Admin bootstrap. Creates the initial Super Admin only if no active
 * Super Admin exists yet. Never overwrites an existing user's password or role on
 * subsequent runs — safe to call on every startup.
 */
export async function bootstrapSuperAdmin(input: {
  email: string;
  password: string;
}): Promise<{ created: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (!email || input.password.length < 8) {
    throw new UserManagementError(
      "INITIAL_SUPER_ADMIN_EMAIL and a password of at least 8 characters are required."
    );
  }

  const existingActive = await countActiveSuperAdmins(prisma);
  if (existingActive > 0) {
    return { created: false };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // A user with this email already exists but there's no active Super Admin (e.g. this
    // account was demoted/deactivated). Do not silently promote — require explicit action.
    throw new UserManagementError(
      `A user with email ${email} already exists. Promote them to Super Admin explicitly instead of bootstrapping.`
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      role: UserRole.super_admin,
      isActive: true,
    },
  });

  await writeAuditLog({
    entityType: "user",
    entityId: user.id,
    action: AUDIT_ACTIONS.SUPER_ADMIN_CREATED,
    actorUserId: null,
    actorEmail: null,
    metadata: { email, source: "bootstrap" },
  });

  return { created: true };
}
