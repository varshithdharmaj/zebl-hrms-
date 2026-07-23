import type { UserRole as PrismaUserRole } from "@/generated/prisma/client";

export const USER_ROLES = ["super_admin", "hr", "employee"] as const;

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
  employee: "Employee",
};

/** Roles that use the admin dashboard shell (HR administration + platform admin). */
export const ADMIN_SHELL_ROLES: AppUserRole[] = ["super_admin", "hr"];

/**
 * Roles linked to an employee record for workforce self-service features.
 * Manager/approval capability is derived from the Employee hierarchy, not the role.
 */
export const WORKFORCE_ROLES: AppUserRole[] = ["employee"];
