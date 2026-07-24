import {
  ApprovalStepStatus,
  ApproverRole,
  type LeaveWorkflowStatus,
} from "@/generated/prisma/client";
import { canAccessAdmin, isSuperAdmin } from "@/lib/permissions";
import { isActiveWorkflow } from "@/lib/workflow/workflow-status";
import type { LeaveWithSteps, WorkflowActor } from "@/lib/workflow/workflow-types";

/** Minimal leave shape for step authorization (server + client UI). */
export type LeaveStepAuthLeave = {
  employeeId: number;
  workflowStatus: LeaveWorkflowStatus;
  currentStepId: number | null;
  approvalSteps: Array<{
    id: number;
    stepOrder: number;
    status: string;
    approverRole: string;
    approverId: number | null;
  }>;
  currentStep?: {
    id: number;
    stepOrder: number;
    status: string;
    approverRole: string;
    approverId: number | null;
  } | null;
};

export type LeaveStepAuthStep = {
  id: number;
  stepOrder: number;
  status: string;
  approverRole: string;
  approverId: number | null;
};

export function getCurrentApprovalStepFromLeave(
  leave: LeaveStepAuthLeave
): LeaveStepAuthStep | null {
  if (!leave.currentStepId) return null;
  return (
    leave.approvalSteps.find((s) => s.id === leave.currentStepId) ??
    leave.currentStep ??
    null
  );
}

/**
 * Whether the actor may approve the leave's current pending step.
 *
 * - Super Admin: any pending step (may be an override — see isSuperAdminWorkflowOverride)
 * - HR: only `hr_admin` step
 * - Manager / skip-level: only when actor.employeeId matches step.approverId
 */
export function canUserApproveStep(
  actor: WorkflowActor,
  leave: LeaveStepAuthLeave | LeaveWithSteps,
  step: LeaveStepAuthStep | null = getCurrentApprovalStepFromLeave(leave)
): boolean {
  if (!step || step.status !== ApprovalStepStatus.pending) return false;
  if (leave.currentStepId !== step.id) return false;
  if (!isActiveWorkflow(leave.workflowStatus)) return false;

  if (actor.employeeId !== null && actor.employeeId === leave.employeeId) {
    return false;
  }

  // Super Admin has full authority over any step.
  if (isSuperAdmin(actor.role)) return true;

  // HR final-approval step: Super Admin + HR.
  if (step.approverRole === ApproverRole.hr_admin) {
    return canAccessAdmin(actor.role);
  }

  // Manager / skip-level steps: designated approver only.
  if (
    step.approverRole === ApproverRole.manager ||
    step.approverRole === ApproverRole.skip_level_manager
  ) {
    return (
      actor.employeeId !== null &&
      step.approverId !== null &&
      actor.employeeId === step.approverId
    );
  }

  return false;
}

/** Reject uses the same step boundary as approve. */
export function canUserRejectStep(
  actor: WorkflowActor,
  leave: LeaveStepAuthLeave | LeaveWithSteps,
  step: LeaveStepAuthStep | null = getCurrentApprovalStepFromLeave(leave)
): boolean {
  return canUserApproveStep(actor, leave, step);
}

/**
 * Superadmin acting on a step outside the normal HR/manager approver path.
 * Approving/rejecting `hr_admin` is normal admin authority (shared with HR), not an override.
 */
export function isSuperAdminWorkflowOverride(
  actor: WorkflowActor,
  leave: LeaveStepAuthLeave | LeaveWithSteps,
  step: LeaveStepAuthStep | null = getCurrentApprovalStepFromLeave(leave)
): boolean {
  if (!isSuperAdmin(actor.role)) return false;
  if (!step || step.status !== ApprovalStepStatus.pending) return false;
  if (leave.currentStepId !== step.id) return false;
  if (!isActiveWorkflow(leave.workflowStatus)) return false;
  if (actor.employeeId !== null && actor.employeeId === leave.employeeId) {
    return false;
  }

  if (step.approverRole === ApproverRole.hr_admin) {
    return false;
  }

  if (
    step.approverRole === ApproverRole.manager ||
    step.approverRole === ApproverRole.skip_level_manager
  ) {
    const isDesignated =
      actor.employeeId !== null &&
      step.approverId !== null &&
      actor.employeeId === step.approverId;
    return !isDesignated;
  }

  return true;
}
