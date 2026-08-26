import type { DateRange, ExecutiveDashboardPayload } from "@/lib/analytics/analytics-types";
import { buildAttendanceInsights } from "@/lib/analytics/attendance-insights";
import { buildLeaveInsights, computeApprovalTurnaroundDelta } from "@/lib/analytics/leave-insights";
import { buildWorkflowInsights } from "@/lib/analytics/workflow-insights";

export async function buildOperationalSummary(
  range: DateRange
): Promise<Pick<ExecutiveDashboardPayload, "bottlenecks" | "trends">> {
  const [, leave, workflow] = await Promise.all([
    buildAttendanceInsights(range),
    buildLeaveInsights(range),
    buildWorkflowInsights(range),
  ]);

  const turnaroundDelta = await computeApprovalTurnaroundDelta();

  return {
    bottlenecks: {
      slowApprovers: workflow.slowApprovers.map((m) => ({
        managerId: m.managerId,
        name: m.name,
        avgHours: m.avgHours,
      })),
      stuckWorkflows: workflow.stuckWorkflows,
      escalationCount: workflow.escalationCount,
    },
    trends: {
      approvalTurnaroundDeltaPct: turnaroundDelta,
      absenteeismDeltaPct: 0,
      projectedStaffingRisks: leave.projectedStaffingRisks,
    },
  };
}

export function buildAttendanceHeatmap(
  byDepartment: { department: string; absentRate: number }[]
): ExecutiveDashboardPayload["heatmap"] {
  const week = new Date().toISOString().slice(0, 10);
  return byDepartment.map((d) => ({
    department: d.department,
    week,
    absentRate: d.absentRate,
  }));
}
