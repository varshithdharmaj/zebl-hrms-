import { getSession, type SessionUser } from "@/lib/auth";
import {
  canAccessAdmin,
  canApproveLeave,
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

export async function requireApproveLeaveSession(): Promise<SessionUser> {
  const session = await getSessionOrThrow();
  requirePermission(session, canApproveLeave);
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

/** Manager routes with linked employee profile */
export async function requireManagerSession(): Promise<SessionWithEmployee> {
  const session = await requireRoleSession("manager");
  if (session.employeeId == null) throw new PermissionError("Manager profile not linked");
  return { ...session, employeeId: session.employeeId };
}
