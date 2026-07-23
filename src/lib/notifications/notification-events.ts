import type { LeaveWorkflowStatus } from "@/generated/prisma/client";

export const NOTIFICATION_EVENTS = {
  LEAVE_SUBMITTED: "LEAVE_SUBMITTED",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  LEAVE_APPROVED: "LEAVE_APPROVED",
  LEAVE_REJECTED: "LEAVE_REJECTED",
  LEAVE_CANCELLED: "LEAVE_CANCELLED",
  LEAVE_WITHDRAWN: "LEAVE_WITHDRAWN",
  STEP_APPROVED: "STEP_APPROVED",
} as const;

export type NotificationEventName =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

export type WorkflowNotificationEvent = {
  leaveRequestId: number;
  event:
    | "submitted"
    | "step_approved"
    | "approval_required"
    | "final_approved"
    | "rejected"
    | "withdrawn"
    | "cancelled";
  workflowStatus: LeaveWorkflowStatus;
  metadata?: {
    comment?: string;
    nextStepId?: number;
    nextApproverId?: number | null;
    actorEmail?: string;
  };
};

export function mapWorkflowEventToNotificationEvent(
  event: WorkflowNotificationEvent["event"]
): NotificationEventName {
  switch (event) {
    case "submitted":
      return NOTIFICATION_EVENTS.LEAVE_SUBMITTED;
    case "step_approved":
      return NOTIFICATION_EVENTS.STEP_APPROVED;
    case "approval_required":
      return NOTIFICATION_EVENTS.APPROVAL_REQUIRED;
    case "final_approved":
      return NOTIFICATION_EVENTS.LEAVE_APPROVED;
    case "rejected":
      return NOTIFICATION_EVENTS.LEAVE_REJECTED;
    case "withdrawn":
      return NOTIFICATION_EVENTS.LEAVE_WITHDRAWN;
    case "cancelled":
      return NOTIFICATION_EVENTS.LEAVE_CANCELLED;
    default:
      return NOTIFICATION_EVENTS.LEAVE_SUBMITTED;
  }
}
