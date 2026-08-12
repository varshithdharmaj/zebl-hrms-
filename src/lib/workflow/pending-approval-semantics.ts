import type { ApprovalStepStatus, LeaveWorkflowStatus } from "@/generated/prisma/client";

/**
 * Canonical leave-approval count concepts (must stay distinct):
 *
 * 1. My Pending Approvals — actionable for an actor (see getPendingApprovalsForActor).
 * 2. Pending Leave Requests — leave.workflowStatus === pending_approval.
 * 3. Open Approval Steps — step.status === pending (includes future chain steps).
 *
 * Org analytics "Pending approvals" = org-wide current actionable steps
 * (Definition 1 without actor filter): pending step that is leave.currentStepId.
 */

export type ApprovalStepLike = {
  id: number;
  status: ApprovalStepStatus | string;
  leaveRequestId: number;
  approverId?: number | null;
  approverRole?: string | null;
};

export type LeaveRequestLike = {
  id: number;
  workflowStatus: LeaveWorkflowStatus | string;
  currentStepId: number | null;
};

/** Definition 3 — every step still marked pending. */
export function isOpenApprovalStep(step: ApprovalStepLike): boolean {
  return step.status === "pending";
}

/** Definition 2 — request still awaiting chain completion. */
export function isPendingLeaveRequest(leave: LeaveRequestLike): boolean {
  return leave.workflowStatus === "pending_approval";
}

/**
 * Org-level current actionable step (Definition 1 without actor filter).
 * Equals the Approval Center current-step predicate.
 */
export function isCurrentActionableApprovalStep(
  step: ApprovalStepLike,
  leave: LeaveRequestLike
): boolean {
  return (
    step.leaveRequestId === leave.id &&
    step.status === "pending" &&
    leave.workflowStatus === "pending_approval" &&
    leave.currentStepId != null &&
    leave.currentStepId === step.id
  );
}

/** Definition 1 — actionable for a line-manager (approverId match). */
export function isMyPendingApprovalForManager(
  step: ApprovalStepLike,
  leave: LeaveRequestLike,
  managerEmployeeId: number
): boolean {
  return (
    isCurrentActionableApprovalStep(step, leave) && step.approverId === managerEmployeeId
  );
}

/** Definition 1 — actionable for HR queue (hr_admin role on current step). */
export function isMyPendingApprovalForHr(
  step: ApprovalStepLike,
  leave: LeaveRequestLike
): boolean {
  return isCurrentActionableApprovalStep(step, leave) && step.approverRole === "hr_admin";
}

export function countOpenApprovalSteps(steps: ApprovalStepLike[]): number {
  return steps.filter(isOpenApprovalStep).length;
}

export function countPendingLeaveRequests(leaves: LeaveRequestLike[]): number {
  return leaves.filter(isPendingLeaveRequest).length;
}

export function countCurrentActionableApprovalSteps(
  steps: ApprovalStepLike[],
  leaves: LeaveRequestLike[]
): number {
  const byId = new Map(leaves.map((l) => [l.id, l]));
  return steps.filter((s) => {
    const leave = byId.get(s.leaveRequestId);
    return leave ? isCurrentActionableApprovalStep(s, leave) : false;
  }).length;
}

export function countMyPendingApprovalsForManager(
  steps: ApprovalStepLike[],
  leaves: LeaveRequestLike[],
  managerEmployeeId: number
): number {
  const byId = new Map(leaves.map((l) => [l.id, l]));
  return steps.filter((s) => {
    const leave = byId.get(s.leaveRequestId);
    return leave ? isMyPendingApprovalForManager(s, leave, managerEmployeeId) : false;
  }).length;
}

export function countMyPendingApprovalsForHr(
  steps: ApprovalStepLike[],
  leaves: LeaveRequestLike[]
): number {
  const byId = new Map(leaves.map((l) => [l.id, l]));
  return steps.filter((s) => {
    const leave = byId.get(s.leaveRequestId);
    return leave ? isMyPendingApprovalForHr(s, leave) : false;
  }).length;
}
