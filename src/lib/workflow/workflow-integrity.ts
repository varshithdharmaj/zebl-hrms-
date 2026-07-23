import {
  ApprovalStepStatus,
  LeaveWorkflowStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { isActiveWorkflow } from "@/lib/workflow/workflow-status";

export type WorkflowIntegrityIssue = {
  leaveRequestId: number;
  code: string;
  message: string;
  severity: "warning" | "error";
};

export async function scanWorkflowIntegrity(): Promise<{
  issues: WorkflowIntegrityIssue[];
  stuckCount: number;
  orphanStepCount: number;
}> {
  const issues: WorkflowIntegrityIssue[] = [];

  const activeLeaves = await prisma.leaveRequest.findMany({
    where: {
      workflowStatus: {
        in: [LeaveWorkflowStatus.pending_approval, LeaveWorkflowStatus.submitted],
      },
    },
    include: {
      approvalSteps: { orderBy: { stepOrder: "asc" } },
      currentStep: true,
    },
    take: 500,
  });

  let orphanStepCount = 0;
  let stuckCount = 0;
  const staleThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const leave of activeLeaves) {
    if (!leave.currentStepId) {
      issues.push({
        leaveRequestId: leave.id,
        code: "missing_current_step",
        message: "Active workflow has no current step pointer.",
        severity: "error",
      });
      orphanStepCount += 1;
      continue;
    }

    const current = leave.approvalSteps.find((s) => s.id === leave.currentStepId);
    if (!current) {
      issues.push({
        leaveRequestId: leave.id,
        code: "orphan_current_step",
        message: "currentStepId does not match any approval step.",
        severity: "error",
      });
      orphanStepCount += 1;
    } else if (current.status !== ApprovalStepStatus.pending) {
      issues.push({
        leaveRequestId: leave.id,
        code: "stale_current_step",
        message: `Current step is ${current.status}, not pending.`,
        severity: "warning",
      });
    }

    const pendingCount = leave.approvalSteps.filter(
      (s) => s.status === ApprovalStepStatus.pending
    ).length;
    if (pendingCount === 0 && isActiveWorkflow(leave.workflowStatus)) {
      issues.push({
        leaveRequestId: leave.id,
        code: "no_pending_steps",
        message: "Workflow is active but no pending approval steps exist.",
        severity: "error",
      });
    }

    if (
      leave.submittedAt &&
      leave.submittedAt.getTime() < staleThreshold &&
      leave.workflowStatus === LeaveWorkflowStatus.pending_approval
    ) {
      stuckCount += 1;
      issues.push({
        leaveRequestId: leave.id,
        code: "stuck_workflow",
        message: "Pending approval older than 7 days.",
        severity: "warning",
      });
    }
  }

  return { issues, stuckCount, orphanStepCount };
}

export async function getStuckWorkflowCount(): Promise<number> {
  const { stuckCount } = await scanWorkflowIntegrity();
  return stuckCount;
}
