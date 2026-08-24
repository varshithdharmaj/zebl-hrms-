import {
  ApprovalStepStatus,
  LeaveWorkflowStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { canAccessAdmin } from "@/lib/permissions";
import {
  countLeaveDays,
  deductLeaveForApproval,
  processPendingLeaveAccruals,
  restoreLeaveBalanceForCancellation,
} from "@/lib/leave";
import { consumeElFifo, restoreElForCancellation } from "@/lib/leave/el-fifo";
import { runElAccrualForEmployeeInTx } from "@/lib/leave/el-accrual-engine";
import { getLeavePolicySettings } from "@/lib/leave/leave-policy";
import { isValidLeaveType, type LeaveType } from "@/lib/leave-types";
import { buildApprovalChain } from "@/lib/workflow/approval-routing";
import {
  canUserApproveStep,
  canUserRejectStep,
  isSuperAdminWorkflowOverride,
} from "@/lib/workflow/step-authorization";
import {
  isActiveWorkflow,
  isTerminalWorkflow,
  workflowToLeaveStatus,
} from "@/lib/workflow/workflow-status";
import type {
  LeaveWithSteps,
  WorkflowActor,
  WorkflowActionResult,
} from "@/lib/workflow/workflow-types";
import {
  MIN_CANCELLATION_REASON_LENGTH,
  MIN_REJECTION_COMMENT_LENGTH,
} from "@/lib/workflow/workflow-types";
import {
  emitWorkflowNotification,
  type WorkflowNotificationEvent,
} from "@/lib/workflow/notification-hooks";
import { leaveRequestWithStepsInclude } from "@/lib/leave/leave-request-include";

export {
  canUserApproveStep,
  canUserRejectStep,
  isSuperAdminWorkflowOverride,
} from "@/lib/workflow/step-authorization";

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export async function loadLeaveWithSteps(leaveId: number): Promise<LeaveWithSteps | null> {
  return prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: leaveRequestWithStepsInclude,
  }) as Promise<LeaveWithSteps | null>;
}

/** Current step from the loaded leave graph (includes `approver` when selected). */
export function getCurrentApprovalStep(leave: LeaveWithSteps) {
  if (!leave.currentStepId) return null;
  return (
    leave.approvalSteps.find((s) => s.id === leave.currentStepId) ??
    leave.currentStep ??
    null
  );
}

export function getNextApprovalStep(leave: LeaveWithSteps) {
  const current = getCurrentApprovalStep(leave);
  if (!current) return null;
  return leave.approvalSteps.find(
    (s) => s.stepOrder > current.stepOrder && s.status === ApprovalStepStatus.pending
  ) ?? null;
}

export function isWorkflowComplete(leave: { workflowStatus: LeaveWorkflowStatus }): boolean {
  return isTerminalWorkflow(leave.workflowStatus);
}

function stepActionAuditMetadata(
  actor: WorkflowActor,
  leave: LeaveWithSteps,
  step: NonNullable<ReturnType<typeof getCurrentApprovalStep>>,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...extra,
    actorRole: actor.role,
    stepOrder: step.stepOrder,
    approverRole: step.approverRole,
    superAdminOverride: isSuperAdminWorkflowOverride(actor, leave, step),
  };
}

/**
 * Atomically claim optimistic lock: UPDATE ... WHERE version = expected [AND extra].
 * Returns false if another writer already moved the version/state.
 */
async function claimLeaveVersion(
  tx: Prisma.TransactionClient,
  leaveId: number,
  expectedVersion: number,
  extraWhere?: Prisma.LeaveRequestWhereInput
): Promise<void> {
  const result = await tx.leaveRequest.updateMany({
    where: { id: leaveId, version: expectedVersion, ...extraWhere },
    data: { version: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new WorkflowError(
      "This request was updated by another user. Please refresh and try again."
    );
  }
}

/** Scalar leave-request updates after {@link claimLeaveVersion} (no further version bump). */
async function updateLeaveState(
  tx: Prisma.TransactionClient,
  leaveId: number,
  data: Prisma.LeaveRequestUpdateInput
): Promise<void> {
  await tx.leaveRequest.update({
    where: { id: leaveId },
    data,
  });
}

async function claimPendingStep(
  tx: Prisma.TransactionClient,
  stepId: number,
  actor: WorkflowActor,
  nextStatus: typeof ApprovalStepStatus.approved | typeof ApprovalStepStatus.rejected,
  comment?: string
): Promise<void> {
  const now = new Date();
  const result = await tx.leaveApprovalStep.updateMany({
    where: { id: stepId, status: ApprovalStepStatus.pending },
    data: {
      status: nextStatus,
      actedAt: now,
      actedByUserId: actor.userId,
      ...(comment !== undefined ? { comment } : {}),
    },
  });
  if (result.count === 0) {
    throw new WorkflowError(
      "This approval step was already actioned. Please refresh and try again."
    );
  }
}

function toWorkflowDomainError(error: unknown): never {
  if (error instanceof WorkflowError) throw error;
  if (error instanceof Error) {
    if (
      error.message.startsWith("Insufficient ") ||
      error.message.includes("was already deducted") ||
      error.message.includes("already has a")
    ) {
      throw new WorkflowError(error.message);
    }
  }
  throw error;
}

async function auditWorkflow(
  params: {
    leaveId: number;
    action: string;
    actor: WorkflowActor;
    metadata: Record<string, unknown>;
  },
  tx?: Prisma.TransactionClient
): Promise<void> {
  await writeAuditLog({
    entityType: "leave_request",
    entityId: String(params.leaveId),
    action: params.action,
    actorUserId: params.actor.userId,
    actorEmail: params.actor.email,
    employeeId: params.actor.employeeId,
    module: "leave",
    metadata: params.metadata,
  }, tx);
}

async function finalizeApproval(
  tx: Prisma.TransactionClient,
  leave: LeaveWithSteps,
  actor: WorkflowActor
): Promise<void> {
  const days = leave.days > 0 ? leave.days : countLeaveDays(leave.startDate, leave.endDate);

  if (!isValidLeaveType(leave.leaveType)) {
    throw new WorkflowError("Invalid leave type on request.");
  }

  try {
    // Same outer transaction — no nested $transaction (avoids partial commits).
    await processPendingLeaveAccruals(leave.employeeId, tx);

    if (leave.leaveType === "EL") {
      const policy = await getLeavePolicySettings();
      await runElAccrualForEmployeeInTx(
        tx,
        { id: leave.employeeId, joiningDate: leave.employee.joiningDate, isActive: leave.employee.isActive },
        policy
      );
      await consumeElFifo(tx, {
        employeeId: leave.employeeId,
        days,
        leaveRequestId: leave.id,
        createdBy: actor.email,
      });
    } else {
      await deductLeaveForApproval({
        employeeId: leave.employeeId,
        leaveType: leave.leaveType,
        days,
        leaveRequestId: leave.id,
        createdBy: actor.email,
        tx,
      });
    }
  } catch (error) {
    toWorkflowDomainError(error);
  }

  const now = new Date();
  await updateLeaveState(tx, leave.id, {
    workflowStatus: LeaveWorkflowStatus.approved,
    status: workflowToLeaveStatus(LeaveWorkflowStatus.approved),
    days,
    finalApprovedAt: now,
    reviewedBy: actor.email,
    reviewedAt: now,
    currentStep: { disconnect: true },
  });
}

/**
 * Emit only after the workflow transaction has committed so token generation
 * and recipient resolution see committed currentStepId / version / steps.
 */
async function emitAfterCommit(
  notification: WorkflowNotificationEvent | null | undefined
): Promise<void> {
  if (!notification) return;
  await emitWorkflowNotification(notification);
}

export async function createLeaveWorkflow(params: {
  employeeId: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  actor: WorkflowActor;
}): Promise<{ leaveId: number }> {
  const chain = await buildApprovalChain({
    employeeId: params.employeeId,
    leaveDays: params.days,
  });

  const leaveId = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const leave = await tx.leaveRequest.create({
      data: {
        employeeId: params.employeeId,
        leaveType: params.leaveType,
        startDate: params.startDate,
        endDate: params.endDate,
        days: params.days,
        reason: params.reason,
        workflowStatus: LeaveWorkflowStatus.pending_approval,
        status: workflowToLeaveStatus(LeaveWorkflowStatus.pending_approval),
        submittedAt: now,
      },
    });

    const steps = await Promise.all(
      chain.map((c) =>
        tx.leaveApprovalStep.create({
          data: {
            leaveRequestId: leave.id,
            stepOrder: c.stepOrder,
            approverId: c.approverId,
            approverRole: c.approverRole,
            status: ApprovalStepStatus.pending,
          },
        })
      )
    );

    const firstStep = steps[0];
    if (firstStep) {
      await tx.leaveRequest.update({
        where: { id: leave.id },
        data: { currentStepId: firstStep.id },
      });
    }

    await auditWorkflow(
      {
        leaveId: leave.id,
        action: AUDIT_ACTIONS.LEAVE_SUBMITTED,
        actor: params.actor,
        metadata: {
          workflowStatus: LeaveWorkflowStatus.pending_approval,
          stepCount: steps.length,
          operation: "submit",
        },
      },
      tx
    );

    return leave.id;
  });

  await emitAfterCommit({
    leaveRequestId: leaveId,
    event: "submitted",
    workflowStatus: LeaveWorkflowStatus.pending_approval,
  });

  return { leaveId };
}

export async function advanceWorkflow(
  leaveId: number,
  actor: WorkflowActor,
  expectedVersion?: number,
  existingTx?: Prisma.TransactionClient
): Promise<WorkflowActionResult> {
  const leave = await loadLeaveWithSteps(leaveId);
  if (!leave) throw new WorkflowError("Leave request not found.");

  const step = getCurrentApprovalStep(leave);
  if (!step) throw new WorkflowError("No pending approval step.");
  if (!canUserApproveStep(actor, leave, step)) {
    throw new WorkflowError("You are not authorized to approve this step.");
  }

  const version = expectedVersion ?? leave.version;
  let pendingNotification: WorkflowNotificationEvent | null = null;

  const run = async (tx: Prisma.TransactionClient): Promise<WorkflowActionResult> => {
    await claimLeaveVersion(tx, leaveId, version, {
      workflowStatus: LeaveWorkflowStatus.pending_approval,
    });
    await claimPendingStep(tx, step.id, actor, ApprovalStepStatus.approved);

    const now = new Date();
    const next = getNextApprovalStep({
      ...leave,
      approvalSteps: leave.approvalSteps.map((s) =>
        s.id === step.id ? { ...s, status: ApprovalStepStatus.approved, actedAt: now } : s
      ),
    });

    if (next) {
      await updateLeaveState(tx, leaveId, {
        currentStep: { connect: { id: next.id } },
      });
      await auditWorkflow(
        {
          leaveId,
          action: AUDIT_ACTIONS.LEAVE_STEP_APPROVED,
          actor,
          metadata: stepActionAuditMetadata(actor, leave, step, {
            stepId: step.id,
            nextStepId: next.id,
            workflowStatus: leave.workflowStatus,
            from: leave.workflowStatus,
            to: leave.workflowStatus,
            operation: "step_approve",
          }),
        },
        tx
      );

      pendingNotification = {
        leaveRequestId: leaveId,
        event: "approval_required",
        workflowStatus: leave.workflowStatus,
        metadata: { nextStepId: next.id, nextApproverId: next.approverId },
      };

      return {
        leaveId,
        workflowStatus: leave.workflowStatus,
        message: "Approval recorded. Request forwarded to the next approver.",
      };
    }

    const fresh = await tx.leaveRequest.findUnique({
      where: { id: leaveId },
      include: leaveRequestWithStepsInclude,
    });
    if (!fresh) throw new WorkflowError("Leave request not found.");

    await finalizeApproval(tx, fresh as LeaveWithSteps, actor);

    await auditWorkflow(
      {
        leaveId,
        action: AUDIT_ACTIONS.LEAVE_STATUS_CHANGED,
        actor,
        metadata: stepActionAuditMetadata(actor, leave, step, {
          from: leave.workflowStatus,
          to: LeaveWorkflowStatus.approved,
          stepId: step.id,
          operation: "final_approve",
        }),
      },
      tx
    );

    pendingNotification = {
      leaveRequestId: leaveId,
      event: "final_approved",
      workflowStatus: LeaveWorkflowStatus.approved,
    };

    return {
      leaveId,
      workflowStatus: LeaveWorkflowStatus.approved,
      message: "Leave request fully approved.",
    };
  };

  if (existingTx) {
    const result = await run(existingTx);
    return {
      ...result,
      pendingNotification: pendingNotification ?? undefined,
    };
  }

  const result = await prisma.$transaction(run);
  await emitAfterCommit(pendingNotification);
  return result;
}

export async function rejectWorkflow(
  leaveId: number,
  actor: WorkflowActor,
  comment: string,
  expectedVersion?: number,
  existingTx?: Prisma.TransactionClient
): Promise<WorkflowActionResult> {
  const trimmed = comment.trim();
  if (trimmed.length < MIN_REJECTION_COMMENT_LENGTH) {
    throw new WorkflowError(
      `Rejection comment must be at least ${MIN_REJECTION_COMMENT_LENGTH} characters.`
    );
  }

  const leave = await loadLeaveWithSteps(leaveId);
  if (!leave) throw new WorkflowError("Leave request not found.");

  const step = getCurrentApprovalStep(leave);
  if (!step) throw new WorkflowError("No pending approval step.");

  // Same step boundary as approve (API/docs: canUserApproveStep). HR must not
  // reject Team Lead / Department Head steps via canAccessAdmin bypass.
  if (!canUserRejectStep(actor, leave, step)) {
    throw new WorkflowError("You are not authorized to reject this request.");
  }

  const version = expectedVersion ?? leave.version;
  let pendingNotification: WorkflowNotificationEvent | null = null;

  const run = async (tx: Prisma.TransactionClient): Promise<WorkflowActionResult> => {
    await claimLeaveVersion(tx, leaveId, version, {
      workflowStatus: LeaveWorkflowStatus.pending_approval,
    });
    await claimPendingStep(tx, step.id, actor, ApprovalStepStatus.rejected, trimmed);

    await tx.leaveApprovalStep.updateMany({
      where: {
        leaveRequestId: leaveId,
        status: ApprovalStepStatus.pending,
        id: { not: step.id },
      },
      data: { status: ApprovalStepStatus.skipped },
    });

    const now = new Date();
    await updateLeaveState(tx, leaveId, {
      workflowStatus: LeaveWorkflowStatus.rejected,
      status: workflowToLeaveStatus(LeaveWorkflowStatus.rejected),
      rejectionReason: trimmed,
      reviewedBy: actor.email,
      reviewedAt: now,
      currentStep: { disconnect: true },
    });

    await auditWorkflow(
      {
        leaveId,
        action: AUDIT_ACTIONS.LEAVE_REJECTED,
        actor,
        metadata: stepActionAuditMetadata(actor, leave, step, {
          from: leave.workflowStatus,
          to: LeaveWorkflowStatus.rejected,
          stepId: step.id,
          comment: trimmed,
          operation: "reject",
        }),
      },
      tx
    );

    pendingNotification = {
      leaveRequestId: leaveId,
      event: "rejected",
      workflowStatus: LeaveWorkflowStatus.rejected,
      metadata: { comment: trimmed },
    };

    return {
      leaveId,
      workflowStatus: LeaveWorkflowStatus.rejected,
      message: "Leave request rejected.",
    };
  };

  if (existingTx) {
    const result = await run(existingTx);
    return {
      ...result,
      pendingNotification: pendingNotification ?? undefined,
    };
  }

  const result = await prisma.$transaction(run);
  await emitAfterCommit(pendingNotification);
  return result;
}

export async function withdrawWorkflow(
  leaveId: number,
  actor: WorkflowActor
): Promise<WorkflowActionResult> {
  const leave = await loadLeaveWithSteps(leaveId);
  if (!leave) throw new WorkflowError("Leave request not found.");

  if (actor.employeeId !== leave.employeeId) {
    throw new WorkflowError("Only the requesting employee can withdraw this leave.");
  }

  if (!isActiveWorkflow(leave.workflowStatus)) {
    throw new WorkflowError("This request can no longer be withdrawn.");
  }

  const anyActed = leave.approvalSteps.some(
    (s) => s.status === ApprovalStepStatus.approved || s.status === ApprovalStepStatus.rejected
  );
  if (anyActed) {
    throw new WorkflowError("Cannot withdraw after an approver has taken action.");
  }

  await prisma.$transaction(async (tx) => {
    await claimLeaveVersion(tx, leaveId, leave.version, {
      workflowStatus: LeaveWorkflowStatus.pending_approval,
    });

    const now = new Date();
    await tx.leaveApprovalStep.updateMany({
      where: { leaveRequestId: leaveId, status: ApprovalStepStatus.pending },
      data: { status: ApprovalStepStatus.skipped },
    });

    await updateLeaveState(tx, leaveId, {
      workflowStatus: LeaveWorkflowStatus.withdrawn,
      status: workflowToLeaveStatus(LeaveWorkflowStatus.withdrawn),
      withdrawnAt: now,
      currentStep: { disconnect: true },
    });

    await auditWorkflow(
      {
        leaveId,
        action: AUDIT_ACTIONS.LEAVE_WITHDRAWN,
        actor,
        metadata: { from: leave.workflowStatus, to: LeaveWorkflowStatus.withdrawn },
      },
      tx
    );
  });

  await emitAfterCommit({
    leaveRequestId: leaveId,
    event: "withdrawn",
    workflowStatus: LeaveWorkflowStatus.withdrawn,
  });

  return {
    leaveId,
    workflowStatus: LeaveWorkflowStatus.withdrawn,
    message: "Leave request withdrawn.",
  };
}

export async function cancelWorkflow(
  leaveId: number,
  actor: WorkflowActor,
  reason: string
): Promise<WorkflowActionResult> {
  if (!canAccessAdmin(actor.role)) {
    throw new WorkflowError("Only HR administrators can cancel approved leave.");
  }

  const trimmed = reason.trim();
  if (trimmed.length < MIN_CANCELLATION_REASON_LENGTH) {
    throw new WorkflowError(
      `Cancellation reason must be at least ${MIN_CANCELLATION_REASON_LENGTH} characters.`
    );
  }

  const leave = await loadLeaveWithSteps(leaveId);
  if (!leave) throw new WorkflowError("Leave request not found.");

  if (leave.workflowStatus !== LeaveWorkflowStatus.approved) {
    throw new WorkflowError("Only approved leave can be cancelled.");
  }

  const days = leave.days > 0 ? leave.days : countLeaveDays(leave.startDate, leave.endDate);
  if (!isValidLeaveType(leave.leaveType)) {
    throw new WorkflowError("Invalid leave type on request.");
  }

  await prisma.$transaction(async (tx) => {
    await claimLeaveVersion(tx, leaveId, leave.version, {
      workflowStatus: LeaveWorkflowStatus.approved,
    });

    try {
      if (leave.leaveType === "EL") {
        await restoreElForCancellation(tx, {
          employeeId: leave.employeeId,
          leaveRequestId: leave.id,
          createdBy: actor.email,
          reason: trimmed,
        });
      } else {
        await restoreLeaveBalanceForCancellation({
          employeeId: leave.employeeId,
          leaveType: leave.leaveType as LeaveType,
          days,
          leaveRequestId: leave.id,
          createdBy: actor.email,
          reason: trimmed,
          tx,
        });
      }
    } catch (error) {
      toWorkflowDomainError(error);
    }

    const now = new Date();
    await updateLeaveState(tx, leaveId, {
      workflowStatus: LeaveWorkflowStatus.cancelled,
      status: workflowToLeaveStatus(LeaveWorkflowStatus.cancelled),
      rejectionReason: trimmed,
      cancelledAt: now,
      currentStep: { disconnect: true },
    });

    await auditWorkflow(
      {
        leaveId,
        action: AUDIT_ACTIONS.LEAVE_CANCELLED,
        actor,
        metadata: {
          from: LeaveWorkflowStatus.approved,
          to: LeaveWorkflowStatus.cancelled,
          reason: trimmed,
          daysRestored: days,
        },
      },
      tx
    );
  });

  await emitAfterCommit({
    leaveRequestId: leaveId,
    event: "cancelled",
    workflowStatus: LeaveWorkflowStatus.cancelled,
    metadata: { comment: trimmed },
  });

  return {
    leaveId,
    workflowStatus: LeaveWorkflowStatus.cancelled,
    message: "Approved leave cancelled and balance restored.",
  };
}

export function toWorkflowActor(session: {
  id: string;
  email: string;
  role: WorkflowActor["role"];
  employeeId: number | null;
}): WorkflowActor {
  return {
    userId: session.id,
    email: session.email,
    role: session.role,
    employeeId: session.employeeId,
  };
}

export async function getLeaveWorkflowDto(leaveId: number) {
  const leave = await loadLeaveWithSteps(leaveId);
  if (!leave) return null;

  const current = getCurrentApprovalStep(leave);
  return {
    id: leave.id,
    employeeId: leave.employeeId,
    employeeName: leave.employee.name,
    leaveType: leave.leaveType,
    startDate: leave.startDate,
    endDate: leave.endDate,
    days: leave.days,
    reason: leave.reason,
    workflowStatus: leave.workflowStatus,
    status: leave.status,
    rejectionReason: leave.rejectionReason,
    submittedAt: leave.submittedAt,
    finalApprovedAt: leave.finalApprovedAt,
    withdrawnAt: leave.withdrawnAt,
    cancelledAt: leave.cancelledAt,
    version: leave.version,
    currentStep: current
      ? {
          id: current.id,
          stepOrder: current.stepOrder,
          approverRole: current.approverRole,
          approverName: current.approver?.name ?? null,
          status: current.status,
        }
      : null,
    steps: leave.approvalSteps.map((s) => ({
      id: s.id,
      stepOrder: s.stepOrder,
      approverRole: s.approverRole,
      approverId: s.approverId,
      approverName: s.approver?.name ?? null,
      status: s.status,
      actedAt: s.actedAt,
      comment: s.comment,
    })),
  };
}
