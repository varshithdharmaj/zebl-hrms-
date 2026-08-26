import type { UserRole as PrismaUserRole } from "@prisma/client";

export const USER_ROLES = ["admin", "hr_admin", "manager", "employee"] as const;

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
  admin: "Administrator",
  hr_admin: "HR Admin",
  manager: "Manager",
  employee: "Employee",
};

/** Roles that use the admin dashboard shell */
export const ADMIN_SHELL_ROLES: AppUserRole[] = ["admin", "hr_admin"];

/** Roles linked to an employee record for workforce features */
export const WORKFORCE_ROLES: AppUserRole[] = ["employee", "manager"];
