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

/**
 * MANAGER is an organizational/application role — "what type of user is this?"
 * It does NOT by itself grant access to any specific team, employee, or leave
 * request. Team-scoped authority still comes exclusively from
 * `Employee.managerId` (see PeopleScopeEngine) and `LeaveApprovalStep.approverId`
 * (see canUserApproveStep) — a Manager with no direct reports has no team scope,
 * and a Manager is never authorized on another manager's team just by role.
 */
export function isManager(role: AppUserRole): boolean {
  return role === "manager";
}

/** Roles with an individual workforce self-service record (own leave/attendance/tickets). */
export function isWorkforceMember(role: AppUserRole): boolean {
  return isEmployee(role) || isManager(role);
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

/**
 * Workforce self-service shell (`/employee/*`): own leave/attendance/tickets,
 * plus (for Manager) the hierarchy-gated My Team pages. Manager does NOT gain
 * `/admin` (HR administration) access through this.
 */
export function canAccessEmployeeShell(role: AppUserRole): boolean {
  return isWorkforceMember(role);
}

/**
 * HR/Super Admin viewing their OWN attendance/leave dashboard, when they also
 * have an Employee record. Narrower than {@link canAccessEmployeeShell}: it
 * only covers the self-service pages (dashboard/attendance/leaves/profile —
 * see `isOwnWorkspaceSelfServicePath`), never the Manager-only My Team pages
 * or the HR ticket queue, which stay on the existing role-only checks.
 */
export function canAccessOwnWorkspace(
  role: AppUserRole,
  employeeId: number | null | undefined
): boolean {
  return canAccessEmployeeShell(role) || (canAccessHRAdministration(role) && employeeId != null);
}

// --- HR operations -------------------------------------------------------

export function canManageEmployee(role: AppUserRole): boolean {
  return canAccessHRAdministration(role);
}

/**
 * UI authorization for profile-photo controls on an employee profile.
 * HR/Super Admin may edit any employee photo; employees may edit only their own.
 * Backend upload (future) must re-check this independently — `editable` is UI-only.
 */
export function canEditEmployeeProfilePhoto(input: {
  actorRole: AppUserRole;
  actorEmployeeId: number | null | undefined;
  targetEmployeeId: number;
}): boolean {
  if (canManageEmployee(input.actorRole)) return true;
  if (input.actorEmployeeId == null) return false;
  return input.actorEmployeeId === input.targetEmployeeId;
}

/**
 * Account-level administration is target-aware: HR may administer employee and
 * Manager accounts (password reset, lock/unlock — account lifecycle, not role
 * assignment), while only Super Admin may administer HR or Super Admin accounts.
 * Manager is included so HR doesn't lose account-administration ability for a
 * user the moment they're promoted from `employee` to `manager`.
 */
export function canAdministerEmployeeAccount(
  actorRole: AppUserRole,
  targetRole: AppUserRole
): boolean {
  if (isSuperAdmin(actorRole)) return true;
  return isHR(actorRole) && (targetRole === "employee" || isManager(targetRole));
}

/** Org-wide analytics (approval insights, workforce metrics). Super Admin + HR. */
export function canViewOrgAnalytics(role: AppUserRole): boolean {
  return canAccessHRAdministration(role);
}

// --- User & role administration (Super Admin only) -----------------------

/** Only Super Admin may change user roles. */
export function canManageUserRoles(actorRole: AppUserRole): boolean {
  return isSuperAdmin(actorRole);
}

/**
 * Target-aware guard: whether `actorRole` may modify a user whose role is `targetRole`
 * (role change, activation/deactivation). Only Super Admin may modify users; a Super
 * Admin target is additionally protected (last-Super-Admin and self-action checks are
 * enforced server-side in the mutation layer).
 */
export function canModifyTargetUser(actorRole: AppUserRole, targetRole: AppUserRole): boolean {
  // Only Super Admin may modify users. A non-Super-Admin actor may never modify anyone —
  // in particular a Super Admin target is protected from HR/Manager/employee actors, and a
  // Manager can never modify themselves or anyone else. Last-Super-Admin and self-action
  // protections are enforced server-side in the mutation layer.
  if (!isSuperAdmin(actorRole)) return false;
  return isSuperAdmin(targetRole) || isHR(targetRole) || isManager(targetRole) || isEmployee(targetRole);
}

/** Roles an actor is permitted to assign to other users. Manager assignment stays Super-Admin-only. */
export function assignableRolesFor(actorRole: AppUserRole): AppUserRole[] {
  return isSuperAdmin(actorRole) ? ["super_admin", "hr", "manager", "employee"] : [];
}

/**
 * Attendance scheduling (weekly working days, date overrides) is platform-level
 * configuration — HR may view it (via the /admin shell), only Super Admin may modify it.
 */
export function canManageAttendanceScheduling(role: AppUserRole): boolean {
  return isSuperAdmin(role);
}

// --- Ticket system -------------------------------------------------------

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
