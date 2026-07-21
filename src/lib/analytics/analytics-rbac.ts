import type { SessionUser } from "@/lib/session";
import type { AnalyticsScope } from "@prisma/client";
import { canAccessAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export function canViewOrgAnalytics(session: SessionUser): boolean {
  return canAccessAdmin(session.role);
}

export async function canViewDepartmentAnalytics(
  session: SessionUser,
  department: string
): Promise<boolean> {
  if (canAccessAdmin(session.role)) return true;
  // Department analytics visibility for line-managers is derived from the Employee
  // hierarchy (they manage reports in that department), independent of app role.
  if (!session.employeeId) return false;
  const team = await prisma.employee.findMany({
    where: { managerId: session.employeeId, isActive: true },
    select: { department: true },
  });
  const depts = new Set(team.map((e) => e.department).filter(Boolean));
  return depts.has(department);
}

export async function getManagerScopeKeys(session: SessionUser): Promise<{
  employeeIds: number[];
  departments: string[];
}> {
  if (!session.employeeId) return { employeeIds: [], departments: [] };
  const reports = await prisma.employee.findMany({
    where: { managerId: session.employeeId, isActive: true },
    select: { id: true, department: true },
  });
  return {
    employeeIds: reports.map((r) => r.id),
    departments: [...new Set(reports.map((r) => r.department).filter((d): d is string => !!d))],
  };
}

export function filterPayloadByScope<T extends { scope: AnalyticsScope; scopeKey: string }>(
  items: T[],
  session: SessionUser,
  allowed: { org: boolean; departments: string[]; employeeIds: number[] }
): T[] {
  if (allowed.org) return items;
  return items.filter((item) => {
    if (item.scope === "department" && allowed.departments.includes(item.scopeKey)) return true;
    if (item.scope === "employee" && allowed.employeeIds.includes(parseInt(item.scopeKey, 10))) {
      return true;
    }
    if (item.scope === "team" && allowed.employeeIds.includes(parseInt(item.scopeKey, 10))) {
      return true;
    }
    return false;
  });
}
