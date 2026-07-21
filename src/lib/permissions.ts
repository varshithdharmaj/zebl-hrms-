import type { SessionUser } from "@/lib/session";
import { type AppUserRole } from "@/lib/roles";

export class PermissionError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "PermissionError";
  }
}

// --- Role identity -------------------------------------------------------

export function isSuperAdmin(role: AppUserRole): boolean {
  return role === "super_admin";
}

export function isHR(role: AppUserRole): boolean {
  return role === "hr";
}

export function isEmployee(role: AppUserRole): boolean {
  return role === "employee";
}

// --- Area access ---------------------------------------------------------

/** Platform & security administration (user management, system config, audit) — Super Admin only. */
export function canAccessPlatformAdministration(role: AppUserRole): boolean {
  return isSuperAdmin(role);
}

/** HR administration — the `/admin/*` operations shell. Super Admin + HR. */
export function canAccessHRAdministration(role: AppUserRole): boolean {
  return isSuperAdmin(role) || isHR(role);
}

/**
 * Legacy name retained across the codebase: "can access the /admin shell".
 * Equivalent to HR administration access (Super Admin + HR).
 */
export function canAccessAdmin(role: AppUserRole): boolean {
  return canAccessHRAdministration(role);
}

/** Employee self-service shell (`/employee/*`). */
export function canAccessEmployeeShell(role: AppUserRole): boolean {
  return isEmployee(role);
}

// --- HR operations -------------------------------------------------------

export function canManageEmployee(role: AppUserRole): boolean {
  return canAccessHRAdministration(role);
}

/**
 * Account-level administration is target-aware: HR may administer employee accounts,
 * while only Super Admin may administer HR or Super Admin accounts.
 */
export function canAdministerEmployeeAccount(
  actorRole: AppUserRole,
  targetRole: AppUserRole
): boolean {
  if (isSuperAdmin(actorRole)) return true;
  return isHR(actorRole) && targetRole === "employee";
}

/** Org-wide analytics (approval insights, workforce metrics). Super Admin + HR. */
export function canViewOrgAnalytics(role: AppUserRole): boolean {
  return canAccessHRAdministration(role);
}

/** Organization-wide login history. Employees are restricted to their own history. */
export function canViewAllLoginHistory(role: AppUserRole): boolean {
  return canAccessHRAdministration(role);
}

/** Failed attempts, Excel export, and force logout are security-sensitive. */
export function canManageLoginSessions(role: AppUserRole): boolean {
  return isSuperAdmin(role);
}

// --- User & role administration (Super Admin only) -----------------------

/** Only Super Admin may change user roles. */
export function canManageUserRoles(actorRole: AppUserRole): boolean {
  return isSuperAdmin(actorRole);
}

/**
 * Target-aware guard: whether `actorRole` may modify a user whose role is `targetRole`
 * (role change, activation/deactivation). In the three-role model only Super Admin may
 * modify users; a Super Admin target is additionally protected (last-Super-Admin and
 * self-action checks are enforced server-side in the mutation layer).
 */
export function canModifyTargetUser(actorRole: AppUserRole, targetRole: AppUserRole): boolean {
  // Only Super Admin may modify users. A non-Super-Admin actor may never modify anyone —
  // in particular a Super Admin target is protected from HR/employee actors. Last-Super-Admin
  // and self-action protections are enforced server-side in the mutation layer.
  if (!isSuperAdmin(actorRole)) return false;
  return isSuperAdmin(targetRole) || isHR(targetRole) || isEmployee(targetRole);
}

/** Roles an actor is permitted to assign to other users. */
export function assignableRolesFor(actorRole: AppUserRole): AppUserRole[] {
  return isSuperAdmin(actorRole) ? ["super_admin", "hr", "employee"] : [];
}

/**
 * Attendance scheduling (weekly working days, date overrides) is platform-level
 * configuration — HR may view it (via the /admin shell), only Super Admin may modify it.
 */
export function canManageAttendanceScheduling(role: AppUserRole): boolean {
  return isSuperAdmin(role);
}

// --- Ticket system -------------------------------------------------------

/** Access to the ticketing/helpdesk system. All roles may access (scoped differently). */
export function canAccessTicketing(role: AppUserRole): boolean {
  return isEmployee(role) || isHR(role) || isSuperAdmin(role);
}

/** Access to anonymous ticket queue (Super Admin only). */
export function canAccessAnonymousTickets(role: AppUserRole): boolean {
  return isSuperAdmin(role);
}

// --- Generic helpers -----------------------------------------------------

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
