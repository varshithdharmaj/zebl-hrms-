import type { SessionUser } from "@/lib/session";
import { ADMIN_SHELL_ROLES, type AppUserRole } from "@/lib/roles";

export class PermissionError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "PermissionError";
  }
}

export function canAccessAdmin(role: AppUserRole): boolean {
  return ADMIN_SHELL_ROLES.includes(role);
}

export function canManageEmployee(role: AppUserRole): boolean {
  return role === "admin" || role === "hr_admin";
}

/** HR final approval today; managers included for future workflow steps */
export function canApproveLeave(role: AppUserRole): boolean {
  return role === "admin" || role === "hr_admin" || role === "manager";
}

export function canAccessManagerShell(role: AppUserRole): boolean {
  return role === "manager";
}

export function canAccessEmployeeShell(role: AppUserRole): boolean {
  return role === "employee";
}

export function canViewOrgAnalytics(role: AppUserRole): boolean {
  return canAccessAdmin(role);
}

export function canViewManagerAnalytics(role: AppUserRole): boolean {
  return role === "manager" || canAccessAdmin(role);
}

export function hasPermission(
  session: SessionUser | null,
  check: (role: AppUserRole) => boolean
): session is SessionUser {
  if (!session) return false;
  return check(session.role);
}

export function requireRole(
  session: SessionUser | null,
  allowed: AppUserRole | AppUserRole[]
): asserts session is SessionUser {
  if (!session) throw new PermissionError();
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(session.role)) throw new PermissionError();
}

export function requirePermission(
  session: SessionUser | null,
  check: (role: AppUserRole) => boolean,
  message = "Unauthorized"
): asserts session is SessionUser {
  if (!hasPermission(session, check)) {
    throw new PermissionError(message);
  }
}
