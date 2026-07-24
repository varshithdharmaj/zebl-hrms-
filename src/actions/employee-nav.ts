"use server";

import { getSession } from "@/lib/auth";
import { canAccessEmployeeShell } from "@/lib/permissions";
import { employeeHasDirectReports } from "@/lib/employees/direct-reports";

/**
 * Presentation-only: whether to show Team Approvals in the employee shell nav.
 * Not an authorization gate — the approvals page enforces access via hierarchy.
 */
export async function hasDirectReportsNavAction(): Promise<boolean> {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    return false;
  }
  return employeeHasDirectReports(session.employeeId);
}
