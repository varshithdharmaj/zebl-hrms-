import { createHmac, createHash, randomUUID } from "crypto";
import { ApprovalTokenAction, ApprovalTokenStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getAppBaseUrl } from "@/lib/config/app-url";
import { DEFAULT_TOKEN_TTL_HOURS, type SignedApprovalToken } from "@/lib/approval-tokens/token-types";

function getSecret(): string {
  const secret = process.env.APPROVAL_TOKEN_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("APPROVAL_TOKEN_SECRET or AUTH_SECRET must be set");
  return secret;
}

function ttlHours(): number {
  const h = parseInt(process.env.APPROVAL_TOKEN_TTL_HOURS ?? String(DEFAULT_TOKEN_TTL_HOURS), 10);
  return Number.isNaN(h) ? DEFAULT_TOKEN_TTL_HOURS : h;
}

export function signToken(id: string, action: ApprovalTokenAction): SignedApprovalToken {
  const sig = createHmac("sha256", getSecret()).update(`${id}:${action}`).digest("base64url");
  return `${id}.${sig}` as SignedApprovalToken;
}

export function hashStoredToken(signed: string): string {
  return createHash("sha256").update(signed).digest("hex");
}

export function buildPublicApprovalUrl(signed: SignedApprovalToken): string {
  return `${getAppBaseUrl()}/approve/${encodeURIComponent(signed)}`;
}

export async function revokeTokensForStep(
  leaveRequestId: number,
  approvalStepId: number,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  await client.approvalToken.updateMany({
    where: {
      leaveRequestId,
      approvalStepId,
      status: ApprovalTokenStatus.active,
    },
    data: { status: ApprovalTokenStatus.revoked, revokedAt: new Date() },
  });
}

export async function createApprovalTokenPair(params: {
  leaveRequestId: number;
  approvalStepId: number;
  approverId: number | null;
  approverUserId: string | null;
  createdBy?: string;
}): Promise<{ approveUrl: string; rejectUrl: string; expiresAt: Date } | null> {
  const expiresAt = new Date(Date.now() + ttlHours() * 60 * 60 * 1000);

  await revokeTokensForStep(params.leaveRequestId, params.approvalStepId);

  const approveId = randomUUID();
  const rejectId = randomUUID();

  const approveSigned = signToken(approveId, ApprovalTokenAction.approve);
  const rejectSigned = signToken(rejectId, ApprovalTokenAction.reject);

  await prisma.approvalToken.createMany({
    data: [
      {
        id: approveId,
        leaveRequestId: params.leaveRequestId,
        approvalStepId: params.approvalStepId,
        approverId: params.approverId,
        approverUserId: params.approverUserId,
        action: ApprovalTokenAction.approve,
        tokenHash: hashStoredToken(approveSigned),
        expiresAt,
        createdBy: params.createdBy ?? "system",
      },
      {
        id: rejectId,
        leaveRequestId: params.leaveRequestId,
        approvalStepId: params.approvalStepId,
        approverId: params.approverId,
        approverUserId: params.approverUserId,
        action: ApprovalTokenAction.reject,
        tokenHash: hashStoredToken(rejectSigned),
        expiresAt,
        createdBy: params.createdBy ?? "system",
      },
    ],
  });

  const correlationId = `leave-${params.leaveRequestId}-step-${params.approvalStepId}`;

  await writeAuditLog({
    entityType: "approval_token",
    entityId: approveId,
    action: AUDIT_ACTIONS.TOKEN_CREATED,
    metadata: {
      leaveRequestId: params.leaveRequestId,
      approvalStepId: params.approvalStepId,
      action: "approve",
      expiresAt: expiresAt.toISOString(),
      correlationId,
    },
  });

  await writeAuditLog({
    entityType: "approval_token",
    entityId: rejectId,
    action: AUDIT_ACTIONS.TOKEN_CREATED,
    metadata: {
      leaveRequestId: params.leaveRequestId,
      approvalStepId: params.approvalStepId,
      action: "reject",
      expiresAt: expiresAt.toISOString(),
      correlationId,
    },
  });

  return {
    approveUrl: buildPublicApprovalUrl(approveSigned),
    rejectUrl: buildPublicApprovalUrl(rejectSigned),
    expiresAt,
  };
}

/** Create email approval links for the leave request's current pending step. */
export async function createTokensForCurrentStep(leaveRequestId: number): Promise<{
  approveUrl: string;
  rejectUrl: string;
  expiresAt: Date;
} | null> {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: { currentStep: true },
  });

  if (!leave?.currentStepId || !leave.currentStep) return null;

  const step = leave.currentStep;
  let approverUserId: string | null = null;

  if (step.approverId) {
    const user = await prisma.user.findFirst({
      where: { employeeId: step.approverId },
      select: { id: true },
    });
    approverUserId = user?.id ?? null;
  } else if (step.approverRole === "hr_admin") {
    const hr = await prisma.user.findFirst({
      where: { role: { in: ["super_admin", "hr"] } },
      select: { id: true },
    });
    approverUserId = hr?.id ?? null;
  }

  return createApprovalTokenPair({
    leaveRequestId,
    approvalStepId: step.id,
    approverId: step.approverId,
    approverUserId,
  });
}
