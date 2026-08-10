import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { withTiming } from "@/lib/observability/timing";
import { computeEmployeePeriodMetrics } from "@/lib/payroll/payroll-calculations";
import type { PayrollPeriod } from "@/lib/payroll/payroll-period";
import { getOperationalShiftFilterOption } from "@/lib/attendance-shift";
import { getPayrollSettings } from "@/lib/payroll/payroll-settings";

export { PAYROLL_HR_DECISION_OPTIONS } from "@/lib/payroll/payroll-types";

/** Parallel upserts per wave — cuts RTT-bound sequential writes without flooding the pooler. */
const PAYROLL_UPSERT_CONCURRENCY = 20;

async function recomputePayrollSummariesForPeriodImpl(period: PayrollPeriod): Promise<number> {
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
  for (let i = 0; i < employees.length; i += PAYROLL_UPSERT_CONCURRENCY) {
    const batch = employees.slice(i, i + PAYROLL_UPSERT_CONCURRENCY);
    await Promise.all(
      batch.map(async (employee) => {
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
      })
    );
    upserted += batch.length;
  }

  return upserted;
}

/**
 * Request-scoped dedupe by period key so cards + table (Promise.all) do not
 * run two full recomputes on the same page load.
 */
const recomputeOncePerRequest = cache(
  async (periodKey: string, startMs: number, endMs: number): Promise<number> => {
    const period: PayrollPeriod = {
      key: periodKey,
      start: new Date(startMs),
      end: new Date(endMs),
      label: periodKey,
    };
    return withTiming(
      "payroll.recompute",
      () => recomputePayrollSummariesForPeriodImpl(period),
      { periodKey }
    );
  }
);

export async function recomputePayrollSummariesForPeriod(period: PayrollPeriod): Promise<number> {
  return recomputeOncePerRequest(period.key, period.start.getTime(), period.end.getTime());
}

/**
 * Recompute only when the period has no (or incomplete) summary rows.
 * Explicit refresh should call `recomputePayrollSummariesForPeriod` instead.
 */
export async function ensurePayrollSummariesForPeriod(period: PayrollPeriod): Promise<number> {
  const periodWhere = {
    payrollPeriodStart: period.start,
    payrollPeriodEnd: period.end,
    employee: { isActive: true },
  };

  const [activeEmployees, existingSummaries] = await Promise.all([
    prisma.employee.count({ where: { isActive: true } }),
    prisma.payrollAttendanceSummary.count({ where: periodWhere }),
  ]);

  if (existingSummaries >= activeEmployees && activeEmployees > 0) {
    return 0;
  }

  return recomputePayrollSummariesForPeriod(period);
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

export type PayrollReadOptions = {
  /**
   * `ensure` (default): recompute only if summaries are missing/incomplete.
   * `force`: always recompute (export / explicit refresh).
   * `skip`: never recompute (read-only).
   */
  recompute?: "ensure" | "force" | "skip";
};

async function preparePayrollSummaries(
  period: PayrollPeriod,
  options: PayrollReadOptions = {}
): Promise<void> {
  const mode = options.recompute ?? "ensure";
  if (mode === "skip") return;
  if (mode === "force") {
    await recomputePayrollSummariesForPeriod(period);
    return;
  }
  await ensurePayrollSummariesForPeriod(period);
}

export async function getPayrollAttendanceSummaries(
  period: PayrollPeriod,
  filters: PayrollAttendanceFilters = {},
  options: PayrollReadOptions = {}
) {
  await preparePayrollSummaries(period, options);

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

  return withTiming(
    "payroll.summaries.read",
    () =>
      prisma.payrollAttendanceSummary.findMany({
        where: summaryWhere,
        include: {
          employee: {
            include: {
              manager: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ shortfallMinutes: "desc" }, { employee: { name: "asc" } }],
      }),
    { periodKey: period.key }
  );
}

export async function getPayrollDashboardCards(
  period: PayrollPeriod,
  options: PayrollReadOptions = {}
) {
  await preparePayrollSummaries(period, options);

  const baseWhere = {
    payrollPeriodStart: period.start,
    payrollPeriodEnd: period.end,
    employee: { isActive: true },
  };

  return withTiming(
    "payroll.cards.read",
    async () => {
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
    },
    { periodKey: period.key }
  );
}
