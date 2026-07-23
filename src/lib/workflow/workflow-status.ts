import type { LeaveRequestStatus, LeaveWorkflowStatus } from "@/generated/prisma/client";

export const WORKFLOW_STATUSES = [
  "submitted",
  "pending_approval",
  "approved",
  "rejected",
  "withdrawn",
  "cancelled",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_STATUS_LABELS: Record<LeaveWorkflowStatus, string> = {
  submitted: "Submitted",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
};

export const TERMINAL_WORKFLOW_STATUSES: LeaveWorkflowStatus[] = [
  "approved",
  "rejected",
  "withdrawn",
  "cancelled",
];

export function isActiveWorkflow(status: LeaveWorkflowStatus): boolean {
  return status === "submitted" || status === "pending_approval";
}

export function isTerminalWorkflow(status: LeaveWorkflowStatus): boolean {
  return TERMINAL_WORKFLOW_STATUSES.includes(status);
}

/** Maps workflow status to legacy/display leave request status */
export function workflowToLeaveStatus(workflowStatus: LeaveWorkflowStatus): LeaveRequestStatus {
  switch (workflowStatus) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "withdrawn":
      return "withdrawn";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export function displayStatusLabel(
  workflowStatus: LeaveWorkflowStatus,
  legacyStatus?: LeaveRequestStatus
): string {
  return WORKFLOW_STATUS_LABELS[workflowStatus] ?? legacyStatus ?? workflowStatus;
}
