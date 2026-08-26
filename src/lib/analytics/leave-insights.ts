import { LeaveWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/lib/analytics/analytics-types";

export type LeaveInsightSummary = {
  totalApprovedDays: number;
  byType: { leaveType: string; days: number }[];
  seasonalByMonth: { month: string; days: number }[];
  projectedStaffingRisks: string[];
  saturationWarnings: string[];
};

export async function buildLeaveInsights(range: DateRange): Promise<LeaveInsightSummary> {
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      workflowStatus: {
        in: [LeaveWorkflowStatus.approved, LeaveWorkflowStatus.pending_approval],
      },
      startDate: { lte: range.end },
      endDate: { gte: range.start },
    },
    include: { employee: { select: { department: true, name: true } } },
  });

  const byType = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const byDeptWeek = new Map<string, number>();

  for (const l of leaves) {
    byType.set(l.leaveType, (byType.get(l.leaveType) ?? 0) + l.days);
    const month = l.startDate.toISOString().slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + l.days);
    const dept = l.employee.department ?? "Unassigned";
    const weekKey = `${dept}:${l.startDate.toISOString().slice(0, 10)}`;
    byDeptWeek.set(weekKey, (byDeptWeek.get(weekKey) ?? 0) + 1);
  }

  const projectedStaffingRisks: string[] = [];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const upcoming = leaves.filter(
    (l) => l.startDate <= nextWeek && l.endDate >= new Date() && l.workflowStatus === LeaveWorkflowStatus.pending_approval
  );
  const upcomingByDept = new Map<string, number>();
  for (const l of upcoming) {
    const d = l.employee.department ?? "Unassigned";
    upcomingByDept.set(d, (upcomingByDept.get(d) ?? 0) + 1);
  }
  for (const [dept, count] of upcomingByDept) {
    if (count >= 2) {
      projectedStaffingRisks.push(
        `${dept} department may have ${count} overlapping pending leave requests next week`
      );
    }
  }

  const saturationWarnings: string[] = [];
  for (const [key, count] of byDeptWeek) {
    if (count >= 3) {
      const [dept] = key.split(":");
      saturationWarnings.push(`Leave clustering detected in ${dept} (${count} requests same week)`);
    }
  }

  return {
    totalApprovedDays: leaves.reduce((s, l) => s + l.days, 0),
    byType: [...byType.entries()].map(([leaveType, days]) => ({ leaveType, days })),
    seasonalByMonth: [...byMonth.entries()].map(([month, days]) => ({ month, days })),
    projectedStaffingRisks,
    saturationWarnings,
  };
}

export async function computeApprovalTurnaroundDelta(): Promise<number> {
  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

  async function avgHours(from: Date, to: Date) {
    const steps = await prisma.leaveApprovalStep.findMany({
      where: {
        actedAt: { gte: from, lte: to },
        status: { in: ["approved", "rejected"] },
      },
      select: { createdAt: true, actedAt: true },
    });
    if (steps.length === 0) return 0;
    const sum = steps.reduce((s, st) => {
      if (!st.actedAt) return s;
      return s + (st.actedAt.getTime() - st.createdAt.getTime()) / 3_600_000;
    }, 0);
    return sum / steps.length;
  }

  const recent = await avgHours(monthAgo, now);
  const prior = await avgHours(twoMonthsAgo, monthAgo);
  if (prior === 0) return 0;
  return Math.round(((recent - prior) / prior) * 100);
}
