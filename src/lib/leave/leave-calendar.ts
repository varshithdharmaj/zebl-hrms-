import { LeaveWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CalendarLeaveEvent = {
  id: number;
  employeeId: number;
  employeeName: string;
  department: string | null;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  workflowStatus: LeaveWorkflowStatus;
};

export async function getLeaveCalendarEvents(params: {
  start: Date;
  end: Date;
  department?: string;
  teamManagerId?: number;
}): Promise<CalendarLeaveEvent[]> {
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      workflowStatus: {
        in: [LeaveWorkflowStatus.approved, LeaveWorkflowStatus.pending_approval],
      },
      startDate: { lte: params.end },
      endDate: { gte: params.start },
      ...(params.department
        ? { employee: { department: params.department } }
        : {}),
      ...(params.teamManagerId
        ? { employee: { managerId: params.teamManagerId } }
        : {}),
    },
    include: {
      employee: { select: { id: true, name: true, department: true } },
    },
    orderBy: { startDate: "asc" },
    take: 200,
  });

  return leaves.map((l) => ({
    id: l.id,
    employeeId: l.employeeId,
    employeeName: l.employee.name,
    department: l.employee.department,
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    workflowStatus: l.workflowStatus,
  }));
}

export async function getUpcomingHolidays(limit = 8) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.holiday.findMany({
    where: { holidayDate: { gte: today } },
    orderBy: { holidayDate: "asc" },
    take: limit,
  });
}

export async function getHolidaysForRange(start: Date, end: Date) {
  return prisma.holiday.findMany({
    where: { holidayDate: { gte: start, lte: end } },
    orderBy: { holidayDate: "asc" },
  });
}

/** Single-employee variant of getLeaveCalendarEvents, for the employee's own heatmap. */
export async function getApprovedLeaveForEmployeeRange(
  employeeId: number,
  start: Date,
  end: Date
) {
  return prisma.leaveRequest.findMany({
    where: {
      employeeId,
      workflowStatus: LeaveWorkflowStatus.approved,
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { id: true, leaveType: true, startDate: true, endDate: true },
    orderBy: { startDate: "asc" },
  });
}

export async function getCalendarDepartments(): Promise<string[]> {
  const rows = await prisma.employee.findMany({
    where: { department: { not: null }, isActive: true },
    distinct: ["department"],
    select: { department: true },
  });
  return rows.map((r) => r.department!).filter(Boolean).sort();
}
