import {
  ApprovalStepStatus,
  ApproverRole,
  LeaveWorkflowStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { canAccessAdmin } from "@/lib/permissions";
import {
  countLeaveDays,
  deductLeaveForApproval,
  processPendingLeaveAccruals,
  restoreLeaveBalanceForCancellation,
} from "@/lib/leave";
import { isValidLeaveType, type LeaveType } from "@/lib/leave-types";
import { buildApprovalChain } from "@/lib/workflow/approval-routing";
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
import { emitWorkflowNotification } from "@/lib/workflow/notification-hooks";

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

const leaveInclude = {
  employee: true,
  approvalSteps: {
    orderBy: { stepOrder: "asc" as const },
    include: { approver: true },
  },
  currentStep: { include: { approver: true } },
} satisfies Prisma.LeaveRequestInclude;

export async function loadLeaveWithSteps(leaveId: number): Promise<LeaveWithSteps | null> {
  return prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: leaveInclude,
  }) as Promise<LeaveWithSteps | null>;
}

export function getCurrentApprovalStep(leave: LeaveWithSteps) {
  if (!leave.currentStepId) return null;
  return leave.approvalSteps.find((s) => s.id === leave.currentStepId) ?? leave.currentStep ?? null;
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

export function canUserApproveStep(
  actor: WorkflowActor,
  leave: LeaveWithSteps,
  step = getCurrentApprovalStep(leave)
): boolean {
  if (!step || step.status !== ApprovalStepStatus.pending) return false;
  if (leave.currentStepId !== step.id) return false;
  if (!isActiveWorkflow(leave.workflowStatus)) return false;

  if (actor.employeeId !== null && actor.employeeId === leave.employeeId) {
    return false;
  }

  if (actor.role === "admin") return true;

  if (step.approverRole === ApproverRole.hr_admin) {
    return canAccessAdmin(actor.role) || actor.role === "hr_admin";
  }

  if (
    step.approverRole === ApproverRole.manager ||
    step.approverRole === ApproverRole.skip_level_manager
  ) {
    return (
      actor.role === "manager" &&
      actor.employeeId !== null &&
      step.approverId !== null &&
      actor.employeeId === step.approverId
    );
  }

  return false;
}

async function assertVersion(
  tx: Prisma.TransactionClient,
  leaveId: number,
  expectedVersion: number
): Promise<void> {
  const row = await tx.leaveRequest.findUnique({ where: { id: leaveId }, select: { version: true } });
  if (!row || row.version !== expectedVersion) {
    throw new WorkflowError("This request was updated by another user. Please refresh and try again.");
  }
}

async function bumpLeave(
  tx: Prisma.TransactionClient,
  leaveId: number,
  data: Prisma.LeaveRequestUpdateInput
): Promise<void> {
  await tx.leaveRequest.update({
    where: { id: leaveId },
    data: { ...data, version: { increment: 1 } },
  });
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
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      entityType: "leave_request",
      entityId: String(params.leaveId),
      action: params.action,
      actorUserId: params.actor.userId,
      actorEmail: params.actor.email,
      metadata: JSON.stringify(params.metadata),
    },
  });
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

  await processPendingLeaveAccruals(leave.employeeId);

  await deductLeaveForApproval({
    employeeId: leave.employeeId,
    leaveType: leave.leaveType,
    days,
    leaveRequestId: leave.id,
    createdBy: actor.email,
    tx,
  });

  const now = new Date();
  await bumpLeave(tx, leave.id, {
    workflowStatus: LeaveWorkflowStatus.approved,
    status: workflowToLeaveStatus(LeaveWorkflowStatus.approved),
    days,
    finalApprovedAt: now,
    reviewedBy: actor.email,
    reviewedAt: now,
    currentStep: { disconnect: true },
  });
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

  return prisma.$transaction(async (tx) => {
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

    await emitWorkflowNotification({
      leaveRequestId: leave.id,
      event: "submitted",
      workflowStatus: LeaveWorkflowStatus.pending_approval,
    });

    return { leaveId: leave.id };
  });
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

  const run = async (tx: Prisma.TransactionClient) => {
    await assertVersion(tx, leaveId, version);

    const now = new Date();
    await tx.leaveApprovalStep.update({
      where: { id: step.id },
      data: {
        status: ApprovalStepStatus.approved,
        actedAt: now,
        actedByUserId: actor.userId,
      },
    });

    const next = getNextApprovalStep({
      ...leave,
      approvalSteps: leave.approvalSteps.map((s) =>
        s.id === step.id ? { ...s, status: ApprovalStepStatus.approved, actedAt: now } : s
      ),
    });

    if (next) {
      await bumpLeave(tx, leaveId, {
        currentStep: { connect: { id: next.id } },
      });
      await auditWorkflow(
        {
          leaveId,
          action: AUDIT_ACTIONS.LEAVE_STEP_APPROVED,
          actor,
          metadata: {
            stepId: step.id,
            stepOrder: step.stepOrder,
            nextStepId: next.id,
            workflowStatus: leave.workflowStatus,
          },
        },
        tx
      );

      await emitWorkflowNotification({
        leaveRequestId: leaveId,
        event: "approval_required",
        workflowStatus: leave.workflowStatus,
        metadata: { nextStepId: next.id, nextApproverId: next.approverId },
      });

      return {
        leaveId,
        workflowStatus: leave.workflowStatus,
        message: "Approval recorded. Request forwarded to the next approver.",
      };
    }

    const fresh = await tx.leaveRequest.findUnique({
      where: { id: leaveId },
      include: leaveInclude,
    });
    if (!fresh) throw new WorkflowError("Leave request not found.");

    await finalizeApproval(tx, fresh as LeaveWithSteps, actor);

    await auditWorkflow(
      {
        leaveId,
        action: AUDIT_ACTIONS.LEAVE_STATUS_CHANGED,
        actor,
        metadata: {
          from: leave.workflowStatus,
          to: LeaveWorkflowStatus.approved,
          stepId: step.id,
          operation: "final_approve",
        },
      },
      tx
    );

    await emitWorkflowNotification({
      leaveRequestId: leaveId,
      event: "final_approved",
      workflowStatus: LeaveWorkflowStatus.approved,
    });

    return {
      leaveId,
      workflowStatus: LeaveWorkflowStatus.approved,
      message: "Leave request fully approved.",
    };
  };

  if (existingTx) return run(existingTx);
  return prisma.$transaction(run);
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

  const canReject =
    canUserApproveStep(actor, leave, step) || canAccessAdmin(actor.role);
  if (!canReject) {
    throw new WorkflowError("You are not authorized to reject this request.");
  }

  const version = expectedVersion ?? leave.version;

  const run = async (tx: Prisma.TransactionClient) => {
    await assertVersion(tx, leaveId, version);

    const now = new Date();
    await tx.leaveApprovalStep.update({
      where: { id: step.id },
      data: {
        status: ApprovalStepStatus.rejected,
        actedAt: now,
        actedByUserId: actor.userId,
        comment: trimmed,
      },
    });

    await tx.leaveApprovalStep.updateMany({
      where: {
        leaveRequestId: leaveId,
        status: ApprovalStepStatus.pending,
        id: { not: step.id },
      },
      data: { status: ApprovalStepStatus.skipped },
    });

    await bumpLeave(tx, leaveId, {
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
        metadata: {
          from: leave.workflowStatus,
          to: LeaveWorkflowStatus.rejected,
          stepId: step.id,
          comment: trimmed,
        },
      },
      tx
    );

    await emitWorkflowNotification({
      leaveRequestId: leaveId,
      event: "rejected",
      workflowStatus: LeaveWorkflowStatus.rejected,
      metadata: { comment: trimmed },
    });

    return {
      leaveId,
      workflowStatus: LeaveWorkflowStatus.rejected,
      message: "Leave request rejected.",
    };
  };

  if (existingTx) return run(existingTx);
  return prisma.$transaction(run);
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

  return prisma.$transaction(async (tx) => {
    await assertVersion(tx, leaveId, leave.version);

    const now = new Date();
    await tx.leaveApprovalStep.updateMany({
      where: { leaveRequestId: leaveId, status: ApprovalStepStatus.pending },
      data: { status: ApprovalStepStatus.skipped },
    });

    await bumpLeave(tx, leaveId, {
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

    await emitWorkflowNotification({
      leaveRequestId: leaveId,
      event: "withdrawn",
      workflowStatus: LeaveWorkflowStatus.withdrawn,
    });

    return {
      leaveId,
      workflowStatus: LeaveWorkflowStatus.withdrawn,
      message: "Leave request withdrawn.",
    };
  });
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

  return prisma.$transaction(async (tx) => {
    await assertVersion(tx, leaveId, leave.version);

    await restoreLeaveBalanceForCancellation({
      employeeId: leave.employeeId,
      leaveType: leave.leaveType as LeaveType,
      days,
      leaveRequestId: leave.id,
      createdBy: actor.email,
      reason: trimmed,
      tx,
    });

    const now = new Date();
    await bumpLeave(tx, leaveId, {
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

    await emitWorkflowNotification({
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
  });
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
