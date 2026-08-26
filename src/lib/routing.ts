import type { AppUserRole } from "@/lib/roles";
import { canAccessAdmin, canAccessManagerShell, canAccessEmployeeShell } from "@/lib/permissions";

export function getDefaultRedirectForRole(role: AppUserRole): string {
  if (canAccessAdmin(role)) return "/admin/dashboard";
  if (canAccessManagerShell(role)) return "/manager/dashboard";
  if (canAccessEmployeeShell(role)) return "/employee/dashboard";
  return "/login";
}

export function getRoleHomePath(role: AppUserRole): string {
  return getDefaultRedirectForRole(role);
}
