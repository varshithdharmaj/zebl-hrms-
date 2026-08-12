import { LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PermissionError } from "@/lib/permissions";
import { PeopleScopeEngine } from "@/lib/people-scope/engine";
import type { ManagerSafeEmployee } from "@/lib/people-scope/types";
import { getLeaveBalanceSummaries } from "@/lib/leave";
import { getEmployeeAttendanceSummary } from "@/lib/data/attendance";
import { toISODate, startOfDay, addDays } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export type ListMyTeamPeopleParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export type MyTeamPeopleListResult = {
  items: ManagerSafeEmployee[];
  total: number;
  page: number;
  pageSize: number;
};

export type MyTeamPersonRecentLeave = {
  id: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  workflowStatus: LeaveWorkflowStatus;
};

export type MyTeamPersonAttendanceSummary = {
  presentDays: number;
  shortHoursCount: number;
  attendancePercent: number;
  lastAttendanceDate: Date | null;
  rangeLabel: string;
};

export type MyTeamPersonDetail = {
  person: ManagerSafeEmployee;
  leaveBalances: Awaited<ReturnType<typeof getLeaveBalanceSummaries>>;
  recentLeaves: MyTeamPersonRecentLeave[];
  attendance: MyTeamPersonAttendanceSummary;
};

function normalizePage(page?: number): number {
  return Math.max(1, page ?? 1);
}

function normalizePageSize(pageSize?: number): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize ?? DEFAULT_PAGE_SIZE));
}

/**
 * Lists DIRECT reports for a line manager (search + pagination + name sort).
 * Scope IDs come exclusively from {@link PeopleScopeEngine}.
 */
export async function listMyTeamPeople(
  managerEmployeeId: number,
  params: ListMyTeamPeopleParams = {}
): Promise<MyTeamPeopleListResult> {
  const isManager = await PeopleScopeEngine.isLineManager(managerEmployeeId);
  if (!isManager) {
    throw new PermissionError("My Team people is only available to line managers.");
  }

  const scope = await PeopleScopeEngine.resolveScope(managerEmployeeId);
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);

  if (scope.employeeIds.length === 0) {
    return { items: [], total: 0, page, pageSize };
  }

  const q = params.search?.trim();
  const where = {
    id: { in: scope.employeeIds },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { employeeCode: { contains: q, mode: "insensitive" as const } },
            { department: { contains: q, mode: "insensitive" as const } },
            { designation: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        name: true,
        department: true,
        designation: true,
        employeeStatus: true,
        isActive: true,
        shift: true,
        joiningDate: true,
        workLocation: true,
        employmentType: true,
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map((row) => PeopleScopeEngine.toManagerSafeEmployee(row)),
    total,
    page,
    pageSize,
  };
}

/**
 * Manager-safe person detail. Always asserts scope before returning data.
 */
export async function getMyTeamPerson(
  managerEmployeeId: number,
  subjectEmployeeId: number
): Promise<MyTeamPersonDetail> {
  // Authoritative IDOR gate — must run before any subject data load.
  await PeopleScopeEngine.assertInScope(managerEmployeeId, subjectEmployeeId);

  const person = await PeopleScopeEngine.getDirectReportSafe(
    managerEmployeeId,
    subjectEmployeeId
  );

  const end = startOfDay();
  const start = addDays(end, -29);
  const startIso = toISODate(start);
  const endIso = toISODate(end);

  const [leaveBalances, recentLeaves, attendanceRaw] = await Promise.all([
    getLeaveBalanceSummaries(subjectEmployeeId, { processAccruals: true }),
    prisma.leaveRequest.findMany({
      where: { employeeId: subjectEmployeeId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        leaveType: true,
        startDate: true,
        endDate: true,
        days: true,
        workflowStatus: true,
      },
    }),
    getEmployeeAttendanceSummary(subjectEmployeeId, startIso, endIso),
  ]);

  return {
    person,
    leaveBalances,
    recentLeaves,
    attendance: {
      presentDays: attendanceRaw.presentDays,
      shortHoursCount: attendanceRaw.shortHoursCount,
      attendancePercent: attendanceRaw.attendancePercent,
      lastAttendanceDate: attendanceRaw.lastAttendanceDate,
      rangeLabel: attendanceRaw.rangeLabel,
    },
  };
}
