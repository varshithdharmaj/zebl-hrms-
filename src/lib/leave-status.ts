import type { LeaveWorkflowStatus } from "@/generated/prisma/client";
import { isActiveWorkflow } from "@/lib/workflow/workflow-status";

/** Whether a leave request is still open for workflow actions (approve/reject/withdraw). */
export function canActOnWorkflow(workflowStatus: LeaveWorkflowStatus): boolean {
  return isActiveWorkflow(workflowStatus);
}
