import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeEmployeePeriodMetrics } from "@/lib/payroll/payroll-calculations";
import type { PayrollPeriod } from "@/lib/payroll/payroll-period";
import { getOperationalShiftFilterOption } from "@/lib/attendance-shift";
import { getPayrollSettings } from "@/lib/payroll/payroll-settings";

export { PAYROLL_HR_DECISION_OPTIONS } from "@/lib/payroll/payroll-types";

export async function recomputePayrollSummariesForPeriod(period: PayrollPeriod): Promise<number> {
  const settings = await getPayrollSettings();

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      shift: true,
    },
  });

  const attendanceByEmployee = await prisma.attendanceRecord.findMany({
    where: {
      attendanceDate: { gte: period.start, lte: period.end },
      employeeId: { in: employees.map((e) => e.id) },
    },
    orderBy: { attendanceDate: "asc" },
  });

  const leaveByEmployee = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      workflowStatus: "approved",
      startDate: { lte: period.end },
      endDate: { gte: period.start },
    },
    select: { employeeId: true, days: true },
  });

  const leaveDaysMap = new Map<number, number>();
  for (const leave of leaveByEmployee) {
    leaveDaysMap.set(leave.employeeId, (leaveDaysMap.get(leave.employeeId) ?? 0) + leave.days);
  }

  const recordsMap = new Map<number, typeof attendanceByEmployee>();
  for (const row of attendanceByEmployee) {
    const list = recordsMap.get(row.employeeId) ?? [];
    list.push(row);
    recordsMap.set(row.employeeId, list);
  }

  let upserted = 0;
  for (const employee of employees) {
    const records = recordsMap.get(employee.id) ?? [];
    const metrics = computeEmployeePeriodMetrics(
      records,
      settings,
      employee.shift,
      leaveDaysMap.get(employee.id) ?? 0
    );

    await prisma.payrollAttendanceSummary.upsert({
      where: {
        employeeId_payrollPeriodStart_payrollPeriodEnd: {
          employeeId: employee.id,
          payrollPeriodStart: period.start,
          payrollPeriodEnd: period.end,
        },
      },
      create: {
        employeeId: employee.id,
        payrollPeriodStart: period.start,
        payrollPeriodEnd: period.end,
        ...metrics,
      },
      update: {
        workingDays: metrics.workingDays,
        requiredMinutes: metrics.requiredMinutes,
        actualMinutes: metrics.actualMinutes,
        shortfallMinutes: metrics.shortfallMinutes,
        otMinutes: metrics.otMinutes,
        leaveDays: metrics.leaveDays,
        absentDays: metrics.absentDays,
        lateCount: metrics.lateCount,
        recommendedDeduction: metrics.recommendedDeduction,
        computedAt: new Date(),
      },
    });
    upserted++;
  }

  return upserted;
}

export type PayrollAttendanceFilters = {
  /** URL slug: morning | night (maps to Employee.shift label) */
  shift?: string;
  hasShortfall?: boolean;
  hasOt?: boolean;
  hasLate?: boolean;
  hasAbsent?: boolean;
  pendingDecision?: boolean;
  search?: string;
};

export async function getPayrollAttendanceSummaries(
  period: PayrollPeriod,
  filters: PayrollAttendanceFilters = {}
) {
  await recomputePayrollSummariesForPeriod(period);

  const employeeWhere: Prisma.EmployeeWhereInput = { isActive: true };

  const shiftFilter = getOperationalShiftFilterOption(filters.shift);
  if (shiftFilter.value) {
    employeeWhere.shift = { equals: shiftFilter.label, mode: "insensitive" };
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    employeeWhere.OR = [{ name: { contains: q } }, { employeeCode: { contains: q } }];
  }

  const summaryWhere: Prisma.PayrollAttendanceSummaryWhereInput = {
    payrollPeriodStart: period.start,
    payrollPeriodEnd: period.end,
    employee: employeeWhere,
  };

  if (filters.hasShortfall) summaryWhere.shortfallMinutes = { gt: 0 };
  if (filters.hasOt) summaryWhere.otMinutes = { gt: 0 };
  if (filters.hasLate) summaryWhere.lateCount = { gt: 0 };
  if (filters.hasAbsent) summaryWhere.absentDays = { gt: 0 };
  if (filters.pendingDecision) summaryWhere.hrDecision = "no_action";

  const rows = await prisma.payrollAttendanceSummary.findMany({
    where: summaryWhere,
    include: {
      employee: {
        include: {
          manager: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ shortfallMinutes: "desc" }, { employee: { name: "asc" } }],
  });

  return rows;
}

export async function getPayrollDashboardCards(period: PayrollPeriod) {
  await recomputePayrollSummariesForPeriod(period);

  const baseWhere = {
    payrollPeriodStart: period.start,
    payrollPeriodEnd: period.end,
    employee: { isActive: true },
  };

  const [totalEmployees, agg, pendingDecisions, withDeductions] = await Promise.all([
    prisma.payrollAttendanceSummary.count({ where: baseWhere }),
    prisma.payrollAttendanceSummary.aggregate({
      where: baseWhere,
      _sum: { otMinutes: true, shortfallMinutes: true },
    }),
    prisma.payrollAttendanceSummary.count({
      where: { ...baseWhere, hrDecision: "no_action", shortfallMinutes: { gt: 0 } },
    }),
    prisma.payrollAttendanceSummary.count({
      where: {
        ...baseWhere,
        hrDecision: { in: ["salary_deduction", "apply_leave"] },
      },
    }),
  ]);

  return {
    totalEmployees,
    totalOtMinutes: agg._sum.otMinutes ?? 0,
    totalShortfallMinutes: agg._sum.shortfallMinutes ?? 0,
    pendingHrDecisions: pendingDecisions,
    employeesWithDeductions: withDeductions,
  };
}

