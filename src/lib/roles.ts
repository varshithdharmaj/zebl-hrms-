import type { UserRole as PrismaUserRole } from "@/generated/prisma/client";

export const USER_ROLES = ["super_admin", "hr", "manager", "employee"] as const;

export type AppUserRole = (typeof USER_ROLES)[number];

export function isAppUserRole(value: string): value is AppUserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function parseAppUserRole(value: string): AppUserRole | null {
  return isAppUserRole(value) ? value : null;
}

export function toAppUserRole(role: PrismaUserRole): AppUserRole {
  return role as AppUserRole;
}

export const ROLE_LABELS: Record<AppUserRole, string> = {
  super_admin: "Super Admin",
  hr: "HR",
  manager: "Manager",
  employee: "Employee",
};

/** Roles that use the admin dashboard shell (HR administration + platform admin). */
export const ADMIN_SHELL_ROLES: AppUserRole[] = ["super_admin", "hr"];

/**
 * Roles linked to an employee record for workforce self-service features
 * (own leave/attendance/tickets, and — for Manager — the My Team pages).
 *
 * `manager` is an application-level capability (who can access Manager features
 * at all); it is independent of `Employee.managerId`/`isLineManager`, which
 * determines *whose* team a given user may act on. A `manager`-role user with
 * zero direct reports sees an empty team, not an error; an `employee`-role user
 * is never shown Manager features even if they happen to have direct reports.
 */
export const WORKFORCE_ROLES: AppUserRole[] = ["employee", "manager"];
