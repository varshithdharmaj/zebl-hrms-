import { ApprovalTokenStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  advanceWorkflow,
  rejectWorkflow,
  toWorkflowActor,
  WorkflowError,
} from "@/lib/workflow/leave-workflow";
import { MIN_REJECTION_COMMENT_LENGTH } from "@/lib/workflow/workflow-types";
import { revokeTokensForStep } from "@/lib/approval-tokens/token-generator";
import { validateApprovalToken } from "@/lib/approval-tokens/token-validator";
import type { ConsumeTokenInput, ConsumeTokenResult } from "@/lib/approval-tokens/token-types";

function rateLimitKey(input: ConsumeTokenInput): string {
  const ip = input.clientIp ?? "unknown";
  const prefix = input.signedToken.slice(0, 24);
  return `approve:${ip}:${prefix}`;
}

export async function consumeApprovalToken(
  input: ConsumeTokenInput
): Promise<ConsumeTokenResult> {
  const rl = checkRateLimit(rateLimitKey(input), 15, 10 * 60 * 1000);
  if (!rl.allowed) {
    return { success: false, message: "Too many attempts. Please wait and try again." };
  }

  const validation = await validateApprovalToken(input.signedToken);
  if (!validation.ok) {
    return { success: false, message: validation.message };
  }

  if (validation.action === "reject") {
    const comment = input.comment?.trim() ?? "";
    if (comment.length < MIN_REJECTION_COMMENT_LENGTH) {
      return {
        success: false,
        message: `Rejection reason must be at least ${MIN_REJECTION_COMMENT_LENGTH} characters.`,
      };
    }
  }

  const tokenRow = await prisma.approvalToken.findUnique({
    where: { id: validation.tokenId },
    include: { leaveRequest: true },
  });

  if (!tokenRow?.approverUserId) {
    return { success: false, message: "Approver account could not be resolved for this link." };
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenRow.approverUserId },
    select: { id: true, email: true, role: true, employeeId: true },
  });

  if (!user) {
    return { success: false, message: "Approver account is no longer available." };
  }

  const actor = toWorkflowActor(user);
  const correlationId = `leave-${tokenRow.leaveRequestId}-step-${tokenRow.approvalStepId}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const consumed = await tx.approvalToken.updateMany({
        where: {
          id: validation.tokenId,
          status: ApprovalTokenStatus.active,
          usedAt: null,
        },
        data: {
          status: ApprovalTokenStatus.consumed,
          usedAt: new Date(),
        },
      });

      if (consumed.count === 0) {
        throw new WorkflowError("This approval link has already been used.");
      }

      const workflowResult =
        validation.action === "approve"
          ? await advanceWorkflow(
              tokenRow.leaveRequestId,
              actor,
              tokenRow.leaveRequest.version,
              tx
            )
          : await rejectWorkflow(
              tokenRow.leaveRequestId,
              actor,
              input.comment!.trim(),
              tokenRow.leaveRequest.version,
              tx
            );

      await tx.approvalToken.updateMany({
        where: {
          leaveRequestId: tokenRow.leaveRequestId,
          approvalStepId: tokenRow.approvalStepId,
          status: ApprovalTokenStatus.active,
        },
        data: {
          status: ApprovalTokenStatus.revoked,
          revokedAt: new Date(),
        },
      });

      await writeAuditLog(
        {
          entityType: "approval_token",
          entityId: validation.tokenId,
          action: AUDIT_ACTIONS.TOKEN_CONSUMED,
          actorUserId: user.id,
          actorEmail: user.email,
          metadata: {
            action: validation.action,
            leaveRequestId: tokenRow.leaveRequestId,
            approvalStepId: tokenRow.approvalStepId,
            clientIp: input.clientIp,
            userAgent: input.userAgent,
            correlationId,
          },
        },
        tx
      );

      await writeAuditLog(
        {
          entityType: "leave_request",
          entityId: String(tokenRow.leaveRequestId),
          action:
            validation.action === "approve"
              ? AUDIT_ACTIONS.APPROVAL_VIA_EMAIL
              : AUDIT_ACTIONS.REJECTION_VIA_EMAIL,
          actorUserId: user.id,
          actorEmail: user.email,
          metadata: {
            tokenId: validation.tokenId,
            clientIp: input.clientIp,
            userAgent: input.userAgent,
            correlationId,
            ...(validation.action === "reject"
              ? { commentLength: input.comment?.trim().length }
              : {}),
          },
        },
        tx
      );

      await revokeTokensForStep(tokenRow.leaveRequestId, tokenRow.approvalStepId, tx);

      return workflowResult;
    });

    return {
      success: true,
      message: result.message,
      workflowStatus: result.workflowStatus,
    };
  } catch (e) {
    const message = e instanceof WorkflowError ? e.message : "Unable to complete approval.";
    return { success: false, message };
  }
}
