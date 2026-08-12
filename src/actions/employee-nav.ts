"use server";

import { getApplicationSession } from "@/lib/auth";
import { canAccessEmployeeShell } from "@/lib/permissions";
import { employeeHasDirectReports } from "@/lib/employees/direct-reports";
import {
  resolveMyTeamNavContext,
  type MyTeamNavContext,
} from "@/lib/people-scope/nav-context";

/**
 * Presentation-only: whether to show Team Approvals in the employee shell nav.
 * Not an authorization gate — the approvals page enforces access via hierarchy.
 *
 * Public API preserved. Eligibility now follows PeopleScopeEngine via
 * {@link employeeHasDirectReports}.
 */
export async function hasDirectReportsNavAction(): Promise<boolean> {
  const session = await getApplicationSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    return false;
  }
  return employeeHasDirectReports(session.employeeId);
}

/**
 * Full My Team nav context for the signed-in employee (presentation-only).
 * Returns null when the session cannot use the employee shell.
 */
export async function getMyTeamNavContextAction(): Promise<MyTeamNavContext | null> {
  const session = await getApplicationSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    return null;
  }
  return resolveMyTeamNavContext(session.employeeId);
}
