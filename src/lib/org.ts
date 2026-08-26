import { prisma } from "@/lib/prisma";

export type { ManagerSummary } from "@/lib/org-types";
import type { ManagerSummary } from "@/lib/org-types";

export async function getManager(employeeId: number): Promise<ManagerSummary | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      manager: {
        select: {
          id: true,
          employeeCode: true,
          name: true,
          department: true,
          designation: true,
        },
      },
    },
  });
  return employee?.manager ?? null;
}

export async function getDirectReports(employeeId: number): Promise<ManagerSummary[]> {
  return prisma.employee.findMany({
    where: { managerId: employeeId },
    select: {
      id: true,
      employeeCode: true,
      name: true,
      department: true,
      designation: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getDirectReportsCount(employeeId: number): Promise<number> {
  return prisma.employee.count({ where: { managerId: employeeId } });
}

/**
 * Returns chain from direct manager up to root (max depth guard).
 */
export async function getManagementChain(employeeId: number, maxDepth = 20): Promise<ManagerSummary[]> {
  const chain: ManagerSummary[] = [];
  let currentId: number | null = employeeId;
  const visited = new Set<number>();
  let depth = 0;

  while (currentId !== null && depth < maxDepth) {
    depth += 1;
    const lookupId: number = currentId;
    const row = await prisma.employee.findUnique({
      where: { id: lookupId },
      select: {
        manager: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            department: true,
            designation: true,
          },
        },
      },
    });
    if (!row?.manager) break;
    if (visited.has(row.manager.id)) break;
    visited.add(row.manager.id);
    chain.push(row.manager);
    currentId = row.manager.id;
  }

  return chain;
}

/**
 * Returns true if assigning managerId to employeeId would create a cycle.
 */
export async function detectCircularManagerRelationship(
  employeeId: number,
  managerId: number
): Promise<boolean> {
  if (employeeId === managerId) return true;

  let cursor: number | null = managerId;
  const visited = new Set<number>([employeeId]);
  let depth = 0;

  while (cursor !== null && depth < 50) {
    depth += 1;
    if (visited.has(cursor)) return true;
    visited.add(cursor);

    const lookupId: number = cursor;
    const row = await prisma.employee.findUnique({
      where: { id: lookupId },
      select: { managerId: true },
    });
    cursor = row?.managerId ?? null;
  }

  return false;
}

export async function getManagerCandidates(
  employeeId: number,
  search?: string
): Promise<ManagerSummary[]> {
  const q = search?.trim();
  return prisma.employee.findMany({
    where: {
      id: { not: employeeId },
      employeeStatus: { not: "Resigned" },
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { employeeCode: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      employeeCode: true,
      name: true,
      department: true,
      designation: true,
    },
    orderBy: { name: "asc" },
    take: 50,
  });
}
