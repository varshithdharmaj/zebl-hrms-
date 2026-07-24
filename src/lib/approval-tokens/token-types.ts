import type { ApprovalTokenAction, ApprovalTokenStatus } from "@/generated/prisma/client";

export type { ApprovalTokenAction, ApprovalTokenStatus };

export const DEFAULT_TOKEN_TTL_HOURS = 72;
export const MIN_REJECTION_COMMENT_LENGTH = 10;

export type SignedApprovalToken = `${string}.${string}`;

export type TokenValidationResult =
  | { ok: true; tokenId: string; action: ApprovalTokenAction }
  | { ok: false; code: TokenErrorCode; message: string };

export type TokenErrorCode =
  | "invalid_format"
  | "invalid_signature"
  | "not_found"
  | "expired"
  | "consumed"
  | "revoked"
  | "action_mismatch"
  | "step_inactive"
  | "workflow_closed"
  | "rate_limited";

export type PublicApprovalView = {
  tokenId: string;
  action: ApprovalTokenAction;
  status: ApprovalTokenStatus;
  expiresAt: Date;
  employeeName: string;
  employeeCode: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  workflowStatus: string;
  approverRole: string;
  approverName: string | null;
  balances: { leaveType: string; remaining: number }[];
  leaveVersion: number;
};

export type ConsumeTokenInput = {
  signedToken: string;
  comment?: string;
  clientIp?: string;
  userAgent?: string;
};

export type ConsumeTokenResult = {
  success: boolean;
  message: string;
  workflowStatus?: string;
};

/** Persisted on ApprovalToken.metadata when the email link is issued. */
export type ApprovalTokenMetadata = {
  leaveVersion: number;
};

export function buildApprovalTokenMetadata(leaveVersion: number): string {
  const payload: ApprovalTokenMetadata = { leaveVersion };
  return JSON.stringify(payload);
}

/**
 * Resolve the optimistic-lock version for email-token consumption.
 * Prefer the snapshot stored when the token was issued; fall back to the
 * live leave row for legacy tokens created before snapshots existed.
 */
export function resolveTokenExpectedVersion(
  metadata: string,
  liveLeaveVersion: number
): number {
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (
      parsed &&
      typeof parsed === "object" &&
      "leaveVersion" in parsed &&
      typeof (parsed as { leaveVersion: unknown }).leaveVersion === "number" &&
      Number.isInteger((parsed as { leaveVersion: number }).leaveVersion) &&
      (parsed as { leaveVersion: number }).leaveVersion >= 0
    ) {
      return (parsed as { leaveVersion: number }).leaveVersion;
    }
  } catch {
    /* legacy / malformed metadata */
  }
  return liveLeaveVersion;
}
