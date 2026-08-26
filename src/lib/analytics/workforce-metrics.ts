import { ApprovalStepStatus, LeaveWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DateRange, MetricInput } from "@/lib/analytics/analytics-types";
import { METRIC_KEYS } from "@/lib/analytics/analytics-types";

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

export async function computeOrgMetrics(range: DateRange): Promise<MetricInput[]> {
  const employees = await prisma.employee.count({ where: { isActive: true } });
  const attendance = await prisma.attendanceRecord.findMany({
    where: { attendanceDate: { gte: range.start, lte: range.end } },
    select: { status: true, workedMinutes: true, overtimeMinutes: true, employeeId: true },
  });

  const total = attendance.length;
  const present = attendance.filter((a) => a.status === "Present").length;
  const absent = attendance.filter((a) => a.status === "Absent").length;
  const shortHours = attendance.filter((a) => a.status === "Short Hours").length;
  const avgOt =
    total > 0
      ? attendance.reduce((s, a) => s + a.overtimeMinutes, 0) / total
      : 0;

  const approvedLeave = await prisma.leaveRequest.findMany({
    where: {
      workflowStatus: LeaveWorkflowStatus.approved,
      startDate: { lte: range.end },
      endDate: { gte: range.start },
    },
    select: { days: true },
  });
  const leaveDays = approvedLeave.reduce((s, l) => s + l.days, 0);

  const pendingSteps = await prisma.leaveApprovalStep.count({
    where: { status: ApprovalStepStatus.pending },
  });

  const escalations = await prisma.workflowEscalation.count({
    where: { sentAt: { gte: range.start, lte: range.end } },
  });

  const period = "monthly" as const;
  const base = {
    scope: "organization" as const,
    scopeKey: "org",
    period,
    periodStart: range.start,
    periodEnd: range.end,
  };

  return [
    { ...base, metricKey: METRIC_KEYS.ATTENDANCE_RATE, value: pct(present + shortHours, total) },
    { ...base, metricKey: METRIC_KEYS.PUNCTUALITY_RATE, value: pct(present, total) },
    { ...base, metricKey: METRIC_KEYS.ABSENTEEISM_RATE, value: pct(absent, total) },
    {
      ...base,
      metricKey: METRIC_KEYS.LEAVE_UTILIZATION,
      value: employees > 0 ? Math.round((leaveDays / employees) * 10) / 10 : 0,
      metadata: { leaveDays, headcount: employees },
    },
    { ...base, metricKey: METRIC_KEYS.OVERTIME_MINUTES_AVG, value: Math.round(avgOt) },
    {
      ...base,
      metricKey: METRIC_KEYS.STAFFING_COVERAGE,
      value: pct(present + shortHours, Math.max(total, employees * 5)),
      metadata: { expectedSlots: employees * 5 },
    },
    { ...base, metricKey: METRIC_KEYS.PENDING_APPROVALS, value: pendingSteps },
    { ...base, metricKey: METRIC_KEYS.ESCALATION_FREQUENCY, value: escalations },
  ];
}

export async function computeDepartmentMetrics(range: DateRange): Promise<MetricInput[]> {
  const employees = await prisma.employee.findMany({
    where: { isActive: true, department: { not: null } },
    select: { id: true, department: true },
  });
  const byDept = new Map<string, number[]>();
  for (const e of employees) {
    const d = e.department!;
    const list = byDept.get(d) ?? [];
    list.push(e.id);
    byDept.set(d, list);
  }

  const metrics: MetricInput[] = [];
  for (const [department, ids] of byDept) {
    const attendance = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: ids },
        attendanceDate: { gte: range.start, lte: range.end },
      },
      select: { status: true },
    });
    const total = attendance.length;
    const absent = attendance.filter((a) => a.status === "Absent").length;
    const present = attendance.filter((a) => a.status === "Present").length;

    metrics.push({
      scope: "department",
      scopeKey: department,
      metricKey: METRIC_KEYS.ATTENDANCE_RATE,
      period: "monthly",
      periodStart: range.start,
      periodEnd: range.end,
      value: pct(present, total),
      metadata: { sampleSize: total },
    });
    metrics.push({
      scope: "department",
      scopeKey: department,
      metricKey: METRIC_KEYS.ABSENTEEISM_RATE,
      period: "monthly",
      periodStart: range.start,
      periodEnd: range.end,
      value: pct(absent, total),
    });
  }
  return metrics;
}

export async function computeManagerSlaMetrics(range: DateRange): Promise<MetricInput[]> {
  const steps = await prisma.leaveApprovalStep.findMany({
    where: {
      status: { in: [ApprovalStepStatus.approved, ApprovalStepStatus.rejected] },
      actedAt: { gte: range.start, lte: range.end },
      approverId: { not: null },
    },
    select: { approverId: true, createdAt: true, actedAt: true },
  });

  const byManager = new Map<number, number[]>();
  for (const s of steps) {
    if (!s.approverId || !s.actedAt) continue;
    const hours = (s.actedAt.getTime() - s.createdAt.getTime()) / 3_600_000;
    const list = byManager.get(s.approverId) ?? [];
    list.push(hours);
    byManager.set(s.approverId, list);
  }

  const slaHours = 48;
  const metrics: MetricInput[] = [];
  for (const [managerId, hours] of byManager) {
    const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
    const compliant = hours.filter((h) => h <= slaHours).length;
    metrics.push({
      scope: "team",
      scopeKey: String(managerId),
      metricKey: METRIC_KEYS.APPROVAL_TURNAROUND_HOURS,
      period: "monthly",
      periodStart: range.start,
      periodEnd: range.end,
      value: Math.round(avg * 10) / 10,
      metadata: { sampleSize: hours.length },
    });
    metrics.push({
      scope: "team",
      scopeKey: String(managerId),
      metricKey: METRIC_KEYS.MANAGER_SLA_COMPLIANCE,
      period: "monthly",
      periodStart: range.start,
      periodEnd: range.end,
      value: pct(compliant, hours.length),
    });
  }
  return metrics;
}

export async function persistMetrics(metrics: MetricInput[]): Promise<number> {
  let count = 0;
  for (const m of metrics) {
    await prisma.workforceMetric.upsert({
      where: {
        scope_scopeKey_metricKey_period_periodStart: {
          scope: m.scope,
          scopeKey: m.scopeKey,
          metricKey: m.metricKey,
          period: m.period,
          periodStart: m.periodStart,
        },
      },
      create: {
        scope: m.scope,
        scopeKey: m.scopeKey,
        metricKey: m.metricKey,
        period: m.period,
        periodStart: m.periodStart,
        periodEnd: m.periodEnd,
        value: m.value,
        metadata: JSON.stringify(m.metadata ?? {}),
      },
      update: {
        value: m.value,
        periodEnd: m.periodEnd,
        metadata: JSON.stringify(m.metadata ?? {}),
        computedAt: new Date(),
      },
    });
    count += 1;
  }
  return count;
}
