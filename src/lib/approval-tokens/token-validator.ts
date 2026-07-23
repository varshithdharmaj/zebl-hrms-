import { createHmac, timingSafeEqual } from "crypto";
import {
  ApprovalStepStatus,
  ApprovalTokenAction,
  ApprovalTokenStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getLeaveBalanceSummaries } from "@/lib/leave";
import { isActiveWorkflow } from "@/lib/workflow/workflow-status";
import { getCurrentApprovalStep, loadLeaveWithSteps } from "@/lib/workflow/leave-workflow";
import { checkRateLimit } from "@/lib/rate-limit";
import type {
  PublicApprovalView,
  TokenErrorCode,
  TokenValidationResult,
} from "@/lib/approval-tokens/token-types";

function getSecret(): string {
  const secret = process.env.APPROVAL_TOKEN_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("APPROVAL_TOKEN_SECRET or AUTH_SECRET must be set");
  return secret;
}

export function parseSignedToken(signed: string): { id: string; signature: string } | null {
  const decoded = decodeURIComponent(signed);
  const dot = decoded.lastIndexOf(".");
  if (dot <= 0 || dot === decoded.length - 1) return null;
  return { id: decoded.slice(0, dot), signature: decoded.slice(dot + 1) };
}

export function verifyTokenSignature(
  id: string,
  action: ApprovalTokenAction,
  signature: string
): boolean {
  const expected = createHmac("sha256", getSecret())
    .update(`${id}:${action}`)
    .digest("base64url");
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function checkApprovalRateLimit(key: string): TokenValidationResult | null {
  const limit = checkRateLimit(key, 40, 15 * 60 * 1000);
  if (!limit.allowed) {
    return {
      ok: false,
      code: "rate_limited",
      message: "Too many requests. Please try again later.",
    };
  }
  return null;
}

async function markExpiredIfNeeded(tokenId: string, expiresAt: Date, status: ApprovalTokenStatus) {
  if (status !== ApprovalTokenStatus.active) return status;
  if (expiresAt >= new Date()) return status;
  await prisma.approvalToken.update({
    where: { id: tokenId },
    data: { status: ApprovalTokenStatus.expired },
  });
  return ApprovalTokenStatus.expired;
}

export async function validateApprovalToken(
  signed: string,
  expectedAction?: ApprovalTokenAction
): Promise<TokenValidationResult> {
  const parsed = parseSignedToken(signed);
  if (!parsed) {
    return { ok: false, code: "invalid_format", message: "Invalid approval link." };
  }

  const record = await prisma.approvalToken.findUnique({
    where: { id: parsed.id },
    include: {
      approvalStep: { include: { approver: true } },
      leaveRequest: { include: { employee: true } },
    },
  });

  if (!record) {
    return { ok: false, code: "not_found", message: "This approval link is not valid." };
  }

  if (!verifyTokenSignature(parsed.id, record.action, parsed.signature)) {
    return { ok: false, code: "invalid_signature", message: "This approval link has been tampered with." };
  }

  if (expectedAction && record.action !== expectedAction) {
    return {
      ok: false,
      code: "action_mismatch",
      message: "This link does not match the requested action.",
    };
  }

  const status = await markExpiredIfNeeded(record.id, record.expiresAt, record.status);

  if (status === ApprovalTokenStatus.consumed || record.usedAt) {
    return { ok: false, code: "consumed", message: "This approval link has already been used." };
  }
  if (status === ApprovalTokenStatus.revoked || record.revokedAt) {
    return { ok: false, code: "revoked", message: "This approval link is no longer valid." };
  }
  if (status === ApprovalTokenStatus.expired) {
    return { ok: false, code: "expired", message: "This approval link has expired." };
  }

  const leave = await loadLeaveWithSteps(record.leaveRequestId);
  if (!leave || !isActiveWorkflow(leave.workflowStatus)) {
    return {
      ok: false,
      code: "workflow_closed",
      message: "This leave request is no longer awaiting approval.",
    };
  }

  const step = getCurrentApprovalStep(leave);
  if (!step || step.id !== record.approvalStepId || step.status !== ApprovalStepStatus.pending) {
    return {
      ok: false,
      code: "step_inactive",
      message: "This approval step is no longer active.",
    };
  }

  return { ok: true, tokenId: record.id, action: record.action };
}

export async function recordTokenView(
  signed: string,
  meta?: { clientIp?: string; userAgent?: string }
): Promise<void> {
  const validation = await validateApprovalToken(signed);
  if (!validation.ok) return;

  const record = await prisma.approvalToken.findUnique({
    where: { id: validation.tokenId },
    select: { viewedAt: true, leaveRequestId: true, approvalStepId: true },
  });
  if (!record || record.viewedAt) return;

  await prisma.approvalToken.update({
    where: { id: validation.tokenId },
    data: { viewedAt: new Date() },
  });

  await writeAuditLog({
    entityType: "approval_token",
    entityId: validation.tokenId,
    action: AUDIT_ACTIONS.TOKEN_VIEWED,
    metadata: {
      leaveRequestId: record.leaveRequestId,
      approvalStepId: record.approvalStepId,
      clientIp: meta?.clientIp,
      userAgent: meta?.userAgent,
      correlationId: `leave-${record.leaveRequestId}-step-${record.approvalStepId}`,
    },
  });
}

export async function buildPublicApprovalView(signed: string): Promise<
  | { ok: true; view: PublicApprovalView; signedToken: string }
  | { ok: false; code: TokenErrorCode; message: string }
> {
  const validation = await validateApprovalToken(signed);
  if (!validation.ok) {
    return { ok: false, code: validation.code, message: validation.message };
  }

  const record = await prisma.approvalToken.findUnique({
    where: { id: validation.tokenId },
    include: {
      approvalStep: { include: { approver: true } },
      leaveRequest: { include: { employee: true } },
    },
  });

  if (!record) {
    return { ok: false, code: "not_found", message: "This approval link is not valid." };
  }

  const balances = await getLeaveBalanceSummaries(record.leaveRequest.employeeId);
  const approverName =
    record.approvalStep.approver?.name ??
    (record.approvalStep.approverRole === "hr_admin" ? "HR Admin" : null);

  return {
    ok: true,
    signedToken: signed,
    view: {
      tokenId: record.id,
      action: record.action,
      status: record.status,
      expiresAt: record.expiresAt,
      employeeName: record.leaveRequest.employee.name,
      employeeCode: record.leaveRequest.employee.employeeCode,
      leaveType: record.leaveRequest.leaveType,
      startDate: record.leaveRequest.startDate.toISOString(),
      endDate: record.leaveRequest.endDate.toISOString(),
      days: record.leaveRequest.days,
      reason: record.leaveRequest.reason,
      workflowStatus: record.leaveRequest.workflowStatus,
      approverRole: record.approvalStep.approverRole,
      approverName,
      balances: balances.map((b) => ({
        leaveType: b.leaveType,
        remaining: b.remaining,
      })),
      leaveVersion: record.leaveRequest.version,
    },
  };
}
