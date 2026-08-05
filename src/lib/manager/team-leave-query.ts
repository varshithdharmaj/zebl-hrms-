import { LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PermissionError } from "@/lib/permissions";
import { PeopleScopeEngine } from "@/lib/people-scope/engine";
import type { ManagerSafeEmployee } from "@/lib/people-scope/types";
import {
  getLeaveBalanceSummariesForEmployees,
  type LeaveBalanceSummary,
} from "@/lib/leave";
import { startOfDay } from "@/lib/utils";

export type MyTeamLeaveRequestSummary = {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  workflowStatus: LeaveWorkflowStatus;
};

export type MyTeamLeaveBalanceRow = {
  employee: ManagerSafeEmployee;
  balances: LeaveBalanceSummary[];
};

export type MyTeamLeaveOverviewDto = {
  directReportCount: number;
  balances: MyTeamLeaveBalanceRow[];
  currentlyOnLeave: MyTeamLeaveRequestSummary[];
  pending: MyTeamLeaveRequestSummary[];
  approved: MyTeamLeaveRequestSummary[];
  rejected: MyTeamLeaveRequestSummary[];
  recent: MyTeamLeaveRequestSummary[];
};

function mapRequest(row: {
  id: number;
  employeeId: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  workflowStatus: LeaveWorkflowStatus;
  employee: { name: string; employeeCode: string };
}): MyTeamLeaveRequestSummary {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    employeeCode: row.employee.employeeCode,
    leaveType: row.leaveType,
    startDate: row.startDate,
    endDate: row.endDate,
    days: row.days,
    workflowStatus: row.workflowStatus,
  };
}

/**
 * Team leave overview — balances + request buckets for DIRECT scope only.
 * Balance math reuses {@link getLeaveBalanceSummariesForEmployees}.
 */
export async function getMyTeamLeaveOverview(
  managerEmployeeId: number
): Promise<MyTeamLeaveOverviewDto> {
  const isManager = await PeopleScopeEngine.isLineManager(managerEmployeeId);
  if (!isManager) {
    throw new PermissionError("My Team leave is only available to line managers.");
  }

  const scope = await PeopleScopeEngine.resolveScope(managerEmployeeId);
  if (scope.employeeIds.length === 0) {
    return {
      directReportCount: 0,
      balances: [],
      currentlyOnLeave: [],
      pending: [],
      approved: [],
      rejected: [],
      recent: [],
    };
  }

  const employees = await prisma.employee.findMany({
    where: { id: { in: scope.employeeIds } },
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
  });

  const today = startOfDay();

  const [summariesByEmployee, recentRows, onLeaveRows] = await Promise.all([
    getLeaveBalanceSummariesForEmployees(employees),
    prisma.leaveRequest.findMany({
      where: { employeeId: { in: scope.employeeIds } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        employeeId: true,
        leaveType: true,
        startDate: true,
        endDate: true,
        days: true,
        workflowStatus: true,
        employee: { select: { name: true, employeeCode: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: scope.employeeIds },
        workflowStatus: LeaveWorkflowStatus.approved,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      orderBy: { employee: { name: "asc" } },
      select: {
        id: true,
        employeeId: true,
        leaveType: true,
        startDate: true,
        endDate: true,
        days: true,
        workflowStatus: true,
        employee: { select: { name: true, employeeCode: true } },
      },
    }),
  ]);

  const recent = recentRows.map(mapRequest);
  const pending = recent.filter((r) => r.workflowStatus === LeaveWorkflowStatus.pending_approval);
  const approved = recent.filter((r) => r.workflowStatus === LeaveWorkflowStatus.approved);
  const rejected = recent.filter((r) => r.workflowStatus === LeaveWorkflowStatus.rejected);

  return {
    directReportCount: employees.length,
    balances: employees.map((emp) => ({
      employee: PeopleScopeEngine.toManagerSafeEmployee(emp),
      balances: summariesByEmployee.get(emp.id) ?? [],
    })),
    currentlyOnLeave: onLeaveRows.map(mapRequest),
    pending,
    approved,
    rejected,
    recent,
  };
}
