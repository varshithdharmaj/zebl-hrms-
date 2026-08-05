/** Approval Center case types — only `leave` is registered in V1. */
export type ApprovalCaseType =
  | "leave"
  | "offer"
  | "expense"
  | "asset"
  | "performance"
  | "travel";

export type ApprovalCaseStatus = "pending" | "approved" | "rejected" | "cancelled";

export type ApprovalCaseAction = "approve" | "reject" | "view";

/**
 * Common approval object (My Team PRD §11).
 * Module adapters map domain rows into this shape.
 */
export type ApprovalCase = {
  caseId: string;
  caseType: ApprovalCaseType;
  title: string;
  subtitle: string;
  subjectEmployeeId: number | null;
  status: ApprovalCaseStatus;
  priority: string | null;
  slaDueAt: Date | null;
  submittedAt: Date | null;
  stepLabel: string;
  actions: ApprovalCaseAction[];
  deepLink: string;
  /** Optimistic concurrency token when the domain supports it (leave version). */
  version: number | null;
};

export type ApprovalActPayload = {
  action: ApprovalCaseAction;
  comment?: string;
  version?: number;
};

export type ApprovalActResult = {
  success?: string;
  error?: string;
};

export type ApprovalAdapter = {
  caseType: ApprovalCaseType;
  listPending: (session: import("@/lib/session").SessionUser) => Promise<ApprovalCase[]>;
  act: (
    session: import("@/lib/session").SessionUser,
    caseId: string,
    payload: ApprovalActPayload
  ) => Promise<ApprovalActResult>;
};

export function toLeaveCaseId(leaveId: number): string {
  return `leave:${leaveId}`;
}

export function parseLeaveCaseId(caseId: string): number | null {
  const match = /^leave:(\d+)$/.exec(caseId);
  if (!match) return null;
  const id = parseInt(match[1] ?? "", 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}
