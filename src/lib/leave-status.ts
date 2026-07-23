import type { LeaveRequestStatus } from "@/generated/prisma/client";
import {
  WORKFLOW_STATUS_LABELS,
  isActiveWorkflow,
  isTerminalWorkflow,
  workflowToLeaveStatus,
} from "@/lib/workflow/workflow-status";
import type { LeaveWorkflowStatus } from "@/generated/prisma/enums";

export { WORKFLOW_STATUS_LABELS as LEAVE_STATUS_LABELS };
export { isActiveWorkflow, isTerminalWorkflow, workflowToLeaveStatus };

export const LEAVE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
  "cancelled",
] as const;

export type LeaveStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

export function isLeaveStatus(value: string): value is LeaveStatus {
  return (LEAVE_REQUEST_STATUSES as readonly string[]).includes(value);
}

export function isValidLeaveStatus(value: string): value is LeaveRequestStatus {
  return isLeaveStatus(value);
}

export function isPendingLeaveStatus(status: string): boolean {
  return status === "pending";
}

export function isTerminalLeaveStatus(status: string): boolean {
  return (
    status === "approved" ||
    status === "rejected" ||
    status === "withdrawn" ||
    status === "cancelled"
  );
}

export function canReviewLeaveStatus(status: string): boolean {
  return isPendingLeaveStatus(status);
}

export function isWorkflowPending(workflowStatus: LeaveWorkflowStatus): boolean {
  return isActiveWorkflow(workflowStatus);
}

export function canActOnWorkflow(workflowStatus: LeaveWorkflowStatus): boolean {
  return isActiveWorkflow(workflowStatus);
}

export type LeaveReviewDecision = "approved" | "rejected";

export function isLeaveReviewDecision(value: string): value is LeaveReviewDecision {
  return value === "approved" || value === "rejected";
}

export function displayLeaveStatus(
  workflowStatus: LeaveWorkflowStatus,
  legacyStatus?: LeaveRequestStatus
): string {
  return WORKFLOW_STATUS_LABELS[workflowStatus] ?? legacyStatus ?? workflowStatus;
}
