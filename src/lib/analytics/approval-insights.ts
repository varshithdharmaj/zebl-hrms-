import { LeaveWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ApprovalInsightPayload } from "@/lib/analytics/analytics-types";
import { formatDate } from "@/lib/utils";

export async function buildApprovalInsights(
  leaveRequestId: number
): Promise<ApprovalInsightPayload | null> {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      employee: { include: { manager: true } },
    },
  });
  if (!leave) return null;

  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  const history = await prisma.leaveRequest.findMany({
    where: {
      employeeId: leave.employeeId,
      createdAt: { gte: yearAgo },
      workflowStatus: {
        in: [
          LeaveWorkflowStatus.approved,
          LeaveWorkflowStatus.rejected,
          LeaveWorkflowStatus.pending_approval,
        ],
      },
    },
    select: { workflowStatus: true, days: true, startDate: true, endDate: true },
  });

  const approved = history.filter((h) => h.workflowStatus === LeaveWorkflowStatus.approved);
  const rejected = history.filter((h) => h.workflowStatus === LeaveWorkflowStatus.rejected);
  const avgDays =
    approved.length > 0
      ? approved.reduce((s, h) => s + h.days, 0) / approved.length
      : 0;

  let overlappingLeaves: { name: string; dates: string }[] = [];
  let teamLeaveDaysThisMonth = 0;
  if (leave.employee.managerId) {
    const teamIds = await prisma.employee.findMany({
      where: { managerId: leave.employee.managerId, isActive: true },
      select: { id: true, name: true },
    });
    const ids = teamIds.map((t) => t.id).filter((id) => id !== leave.employeeId);
    const monthStart = new Date(leave.startDate.getFullYear(), leave.startDate.getMonth(), 1);
    const monthEnd = new Date(leave.startDate.getFullYear(), leave.startDate.getMonth() + 1, 0);

    const teamLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: ids },
        workflowStatus: { in: [LeaveWorkflowStatus.approved, LeaveWorkflowStatus.pending_approval] },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      include: { employee: { select: { name: true } } },
    });

    teamLeaveDaysThisMonth = teamLeaves.reduce((s, l) => s + l.days, 0);
    overlappingLeaves = teamLeaves
      .filter(
        (l) =>
          l.id !== leave.id &&
          l.startDate <= leave.endDate &&
          l.endDate >= leave.startDate
      )
      .map((l) => ({
        name: l.employee.name,
        dates: `${formatDate(l.startDate)} — ${formatDate(l.endDate)}`,
      }));
  }

  const recentApproved = approved.length;
  let burnoutIndicator: "low" | "medium" | "high" = "low";
  let rationale = "Leave frequency within normal range.";
  if (recentApproved >= 4) {
    burnoutIndicator = "high";
    rationale = `${recentApproved} approved leaves in 12 months — elevated utilization.`;
  } else if (recentApproved >= 2) {
    burnoutIndicator = "medium";
    rationale = `${recentApproved} approved leaves in 12 months.`;
  }

  const recommendations: string[] = [];
  if (overlappingLeaves.length > 0) {
    recommendations.push(
      `${overlappingLeaves.length} teammate(s) have overlapping leave — review team coverage.`
    );
  }
  if (teamLeaveDaysThisMonth > 10) {
    recommendations.push(`Team has ${teamLeaveDaysThisMonth} leave days scheduled this month.`);
  }
  if (burnoutIndicator === "high") {
    recommendations.push("Consider workload balance — elevated leave utilization pattern.");
  }
  recommendations.push("Final approval remains with you; these are decision-support signals only.");

  return {
    leaveRequestId,
    employeeName: leave.employee.name,
    leaveSummary: `${leave.leaveType} ${formatDate(leave.startDate)} — ${formatDate(leave.endDate)} (${leave.days} days)`,
    history: {
      approvedLeavesLast12m: approved.length,
      rejectedLeavesLast12m: rejected.length,
      avgDaysPerRequest: Math.round(avgDays * 10) / 10,
    },
    teamImpact: {
      overlappingLeaves,
      teamLeaveDaysThisMonth,
      staffingWarning:
        overlappingLeaves.length >= 2
          ? "Multiple overlapping team leaves may reduce coverage."
          : null,
    },
    workload: { burnoutIndicator, rationale },
    recommendations,
  };
}
