import { getSession, type SessionUser } from "@/lib/auth";
import {
  canAccessAdmin,
  canAccessHRAdministration,
  canAccessPlatformAdministration,
  canManageEmployee,
  PermissionError,
  requirePermission,
} from "@/lib/permissions";
import type { AppUserRole } from "@/lib/roles";

export async function getSessionOrThrow(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new PermissionError("Not authenticated");
  return session;
}

/** Super Admin only — platform & security administration. */
export async function requireSuperAdminSession(): Promise<SessionUser> {
  const session = await getSessionOrThrow();
  requirePermission(session, canAccessPlatformAdministration);
  return session;
}

/** Super Admin or HR — the /admin operations shell. */
export async function requireHROrSuperAdminSession(): Promise<SessionUser> {
  const session = await getSessionOrThrow();
  requirePermission(session, canAccessHRAdministration);
  return session;
}

/**
 * Legacy name retained across the codebase: gate for the /admin shell.
 * Equivalent to {@link requireHROrSuperAdminSession} (Super Admin + HR).
 */
export async function requireAdminSession(): Promise<SessionUser> {
  const session = await getSessionOrThrow();
  requirePermission(session, canAccessAdmin);
  return session;
}

export async function requireManageEmployeeSession(): Promise<SessionUser> {
  const session = await getSessionOrThrow();
  requirePermission(session, canManageEmployee);
  return session;
}

/**
 * Coarse guard for acting on a leave-approval step. Admits HR/Super Admin (HR queue) and
 * any user linked to an Employee record (a potential line-manager approver). Per-step
 * authorization is enforced downstream by `canUserApproveStep` in the workflow layer.
 */
export async function requireApproveLeaveSession(): Promise<SessionUser> {
  const session = await getSessionOrThrow();
  if (!canAccessAdmin(session.role) && session.employeeId == null) {
    throw new PermissionError();
  }
  return session;
}

export async function requireRoleSession(
  allowed: AppUserRole | AppUserRole[]
): Promise<SessionUser> {
  const session = await getSessionOrThrow();
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(session.role)) throw new PermissionError();
  return session;
}

export type SessionWithEmployee = SessionUser & { employeeId: number };

export async function requireEmployeeSession(): Promise<SessionWithEmployee> {
  const session = await requireRoleSession("employee");
  if (session.employeeId == null) throw new PermissionError("Employee profile not linked");
  return { ...session, employeeId: session.employeeId };
}
