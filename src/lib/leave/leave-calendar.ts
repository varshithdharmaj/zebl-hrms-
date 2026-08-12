import { cache } from "react";
import { LeaveWorkflowStatus } from "@/generated/prisma/enums";
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

function yearsTouching(start: Date, end: Date): number[] {
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y += 1) {
    years.push(y);
  }
  return years.length > 0 ? years : [startYear];
}

function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

/** Request-memoized full-year holiday load — MTD + YTD callers in the same request share one query. */
const getHolidaysForYear = cache(async (year: number) => {
  const { start, end } = yearBounds(year);
  return prisma.holiday.findMany({
    where: { holidayDate: { gte: start, lte: end } },
    orderBy: { holidayDate: "asc" },
  });
});

/**
 * Request-memoized approved leave overlapping a calendar year for one employee.
 * Sub-range callers (period classify + YTD heatmap) dedupe within the same request.
 */
const getApprovedLeaveForEmployeeYear = cache(async (employeeId: number, year: number) => {
  const { start, end } = yearBounds(year);
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
});

export async function getLeaveCalendarEvents(params: {
  start: Date;
  end: Date;
  department?: string;
  /** @deprecated Prefer `employeeIds` from PeopleScopeEngine for My Team. */
  teamManagerId?: number;
  /** Restrict to these employee IDs (e.g. My Team DIRECT scope). */
  employeeIds?: number[];
}): Promise<CalendarLeaveEvent[]> {
  if (params.employeeIds && params.employeeIds.length === 0) {
    return [];
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      workflowStatus: {
        in: [LeaveWorkflowStatus.approved, LeaveWorkflowStatus.pending_approval],
      },
      startDate: { lte: params.end },
      endDate: { gte: params.start },
      ...(params.employeeIds
        ? { employeeId: { in: params.employeeIds } }
        : {}),
      ...(params.department
        ? { employee: { department: params.department } }
        : {}),
      ...(!params.employeeIds && params.teamManagerId
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
  const years = yearsTouching(start, end);
  const byYear = await Promise.all(years.map((y) => getHolidaysForYear(y)));
  const startMs = start.getTime();
  const endMs = end.getTime();
  return byYear
    .flat()
    .filter((h) => {
      const t = h.holidayDate.getTime();
      return t >= startMs && t <= endMs;
    })
    .sort((a, b) => a.holidayDate.getTime() - b.holidayDate.getTime());
}

/** Single-employee variant of getLeaveCalendarEvents, for the employee's own heatmap. */
export async function getApprovedLeaveForEmployeeRange(
  employeeId: number,
  start: Date,
  end: Date
) {
  const years = yearsTouching(start, end);
  const byYear = await Promise.all(
    years.map((y) => getApprovedLeaveForEmployeeYear(employeeId, y))
  );
  // Deduplicate leaves that span year boundaries (appear in adjacent year caches).
  const byId = new Map<number, (typeof byYear)[number][number]>();
  for (const row of byYear.flat()) {
    byId.set(row.id, row);
  }
  const startMs = start.getTime();
  const endMs = end.getTime();
  return [...byId.values()]
    .filter((l) => l.startDate.getTime() <= endMs && l.endDate.getTime() >= startMs)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export async function getCalendarDepartments(): Promise<string[]> {
  const rows = await prisma.employee.findMany({
    where: { department: { not: null }, isActive: true },
    distinct: ["department"],
    select: { department: true },
  });
  return rows.map((r) => r.department!).filter(Boolean).sort();
}
