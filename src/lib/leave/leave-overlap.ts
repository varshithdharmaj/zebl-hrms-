import { LeaveWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LeaveOverlapWarning = {
  type: "team_overlap" | "employee_overlap";
  message: string;
  relatedLeaveId: number;
  employeeName: string;
};

const ACTIVE_STATUSES: LeaveWorkflowStatus[] = [
  LeaveWorkflowStatus.pending_approval,
  LeaveWorkflowStatus.approved,
];

export async function getLeaveOverlapWarnings(params: {
  leaveRequestId: number;
  employeeId: number;
  department: string | null;
  startDate: Date;
  endDate: Date;
}): Promise<LeaveOverlapWarning[]> {
  const warnings: LeaveOverlapWarning[] = [];

  const overlapping = await prisma.leaveRequest.findMany({
    where: {
      id: { not: params.leaveRequestId },
      workflowStatus: { in: ACTIVE_STATUSES },
      employeeId: params.employeeId,
      startDate: { lte: params.endDate },
      endDate: { gte: params.startDate },
    },
    include: { employee: { select: { name: true } } },
    take: 3,
  });

  for (const o of overlapping) {
    warnings.push({
      type: "employee_overlap",
      message: `Overlaps with existing ${o.leaveType} request (${o.workflowStatus.replace(/_/g, " ")})`,
      relatedLeaveId: o.id,
      employeeName: o.employee.name,
    });
  }

  if (params.department) {
    const teamOverlaps = await prisma.leaveRequest.findMany({
      where: {
        id: { not: params.leaveRequestId },
        workflowStatus: { in: ACTIVE_STATUSES },
        startDate: { lte: params.endDate },
        endDate: { gte: params.startDate },
        employee: {
          department: params.department,
          id: { not: params.employeeId },
        },
      },
      include: { employee: { select: { name: true } } },
      take: 5,
    });

    for (const t of teamOverlaps) {
      warnings.push({
        type: "team_overlap",
        message: `${t.employee.name} also on leave in this period`,
        relatedLeaveId: t.id,
        employeeName: t.employee.name,
      });
    }
  }

  return warnings;
}

export async function countTeamOnLeaveToday(department: string | null): Promise<number> {
  if (!department) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.leaveRequest.count({
    where: {
      workflowStatus: LeaveWorkflowStatus.approved,
      startDate: { lt: tomorrow },
      endDate: { gte: today },
      employee: { department },
    },
  });
}
