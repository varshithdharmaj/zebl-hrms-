import { ApprovalStepStatus, LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/lib/analytics/analytics-types";

export type WorkflowInsightSummary = {
  slowApprovers: { managerId: number; name: string; avgHours: number; pending: number }[];
  stuckWorkflows: number;
  escalationCount: number;
  avgTurnaroundHours: number;
  recommendations: string[];
};

export async function buildWorkflowInsights(range: DateRange): Promise<WorkflowInsightSummary> {
  const steps = await prisma.leaveApprovalStep.findMany({
    where: {
      actedAt: { gte: range.start, lte: range.end },
      approverId: { not: null },
    },
    include: { approver: true },
  });

  const pendingByManager = await prisma.leaveApprovalStep.groupBy({
    by: ["approverId"],
    where: { status: ApprovalStepStatus.pending, approverId: { not: null } },
    _count: { id: true },
  });
  const pendingMap = new Map(
    pendingByManager.map((p) => [p.approverId!, p._count.id])
  );

  const managerHours = new Map<number, { name: string; hours: number[] }>();
  for (const s of steps) {
    if (!s.approverId || !s.actedAt) continue;
    const h = (s.actedAt.getTime() - s.createdAt.getTime()) / 3_600_000;
    const entry = managerHours.get(s.approverId) ?? {
      name: s.approver?.name ?? `Manager ${s.approverId}`,
      hours: [],
    };
    entry.hours.push(h);
    managerHours.set(s.approverId, entry);
  }

  const slowApprovers = [...managerHours.entries()]
    .map(([managerId, v]) => ({
      managerId,
      name: v.name,
      avgHours: Math.round((v.hours.reduce((a, b) => a + b, 0) / v.hours.length) * 10) / 10,
      pending: pendingMap.get(managerId) ?? 0,
    }))
    .filter((m) => m.avgHours > 24 || m.pending >= 3)
    .sort((a, b) => b.avgHours - a.avgHours)
    .slice(0, 10);

  const stuckWorkflows = await prisma.leaveRequest.count({
    where: {
      workflowStatus: LeaveWorkflowStatus.pending_approval,
      submittedAt: { lt: new Date(Date.now() - 72 * 3_600_000) },
    },
  });

  const escalationCount = await prisma.workflowEscalation.count({
    where: { sentAt: { gte: range.start, lte: range.end } },
  });

  const allHours = steps
    .filter((s) => s.actedAt)
    .map((s) => (s.actedAt!.getTime() - s.createdAt.getTime()) / 3_600_000);
  const avgTurnaroundHours =
    allHours.length > 0
      ? Math.round((allHours.reduce((a, b) => a + b, 0) / allHours.length) * 10) / 10
      : 0;

  const recommendations: string[] = [];
  if (slowApprovers.length > 0) {
    recommendations.push(
      `Review approval load for ${slowApprovers[0].name} (avg ${slowApprovers[0].avgHours}h turnaround).`
    );
  }
  if (stuckWorkflows > 0) {
    recommendations.push(`${stuckWorkflows} workflow(s) pending over 72 hours — consider escalation.`);
  }
  if (escalationCount > 5) {
    recommendations.push(`Escalation frequency is elevated (${escalationCount} in period).`);
  }

  return {
    slowApprovers,
    stuckWorkflows,
    escalationCount,
    avgTurnaroundHours,
    recommendations,
  };
}
