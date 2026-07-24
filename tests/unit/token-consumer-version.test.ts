import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalTokenAction } from "@/generated/prisma/client";

const findUniqueToken = vi.fn();
const findUniqueUser = vi.fn();
const transaction = vi.fn();
const validateApprovalToken = vi.fn();
const advanceWorkflow = vi.fn();
const rejectWorkflow = vi.fn();
const writeAuditLog = vi.fn();
const revokeTokensForStep = vi.fn();
const checkRateLimit = vi.fn(
  (_key: string, _limit: number, _windowMs: number) => ({
    allowed: true,
    retryAfterMs: 0,
  })
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    approvalToken: {
      findUnique: (args: unknown) => findUniqueToken(args),
    },
    user: { findUnique: (args: unknown) => findUniqueUser(args) },
    $transaction: (fn: unknown) => transaction(fn),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (key: string, limit: number, windowMs: number) =>
    checkRateLimit(key, limit, windowMs),
}));

vi.mock("@/lib/approval-tokens/token-validator", () => ({
  validateApprovalToken: (signed: string) => validateApprovalToken(signed),
}));

vi.mock("@/lib/workflow/leave-workflow", () => {
  class WorkflowError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "WorkflowError";
    }
  }
  return {
    WorkflowError,
    advanceWorkflow: (
      leaveId: number,
      actor: unknown,
      expectedVersion?: number,
      tx?: unknown
    ) => advanceWorkflow(leaveId, actor, expectedVersion, tx),
    rejectWorkflow: (
      leaveId: number,
      actor: unknown,
      comment: string,
      expectedVersion?: number,
      tx?: unknown
    ) => rejectWorkflow(leaveId, actor, comment, expectedVersion, tx),
    toWorkflowActor: (user: {
      id: string;
      email: string;
      role: string;
      employeeId: number | null;
    }) => ({
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    }),
  };
});

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    TOKEN_CONSUMED: "token.consumed",
    APPROVAL_VIA_EMAIL: "leave.approval_via_email",
    REJECTION_VIA_EMAIL: "leave.rejection_via_email",
  },
  writeAuditLog: (entry: unknown, tx?: unknown) => writeAuditLog(entry, tx),
}));

vi.mock("@/lib/approval-tokens/token-generator", () => ({
  revokeTokensForStep: (
    leaveRequestId: number,
    approvalStepId: number,
    tx?: unknown
  ) => revokeTokensForStep(leaveRequestId, approvalStepId, tx),
}));

import { consumeApprovalToken } from "@/lib/approval-tokens/token-consumer";
import { WorkflowError } from "@/lib/workflow/leave-workflow";

describe("consumeApprovalToken version semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    validateApprovalToken.mockResolvedValue({
      ok: true,
      tokenId: "tok-1",
      action: ApprovalTokenAction.approve,
    });
    findUniqueUser.mockResolvedValue({
      id: "hr-1",
      email: "hr@test.local",
      role: "hr",
      employeeId: null,
    });
  });

  it("passes the token leaveVersion snapshot into advanceWorkflow", async () => {
    findUniqueToken.mockResolvedValue({
      id: "tok-1",
      leaveRequestId: 10,
      approvalStepId: 20,
      approverUserId: "hr-1",
      metadata: JSON.stringify({ leaveVersion: 3 }),
      leaveRequest: { version: 9 },
    });

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        approvalToken: {
          updateMany: vi
            .fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValue({ count: 0 }),
        },
      };
      advanceWorkflow.mockResolvedValue({
        leaveId: 10,
        workflowStatus: "approved",
        message: "ok",
      });
      return fn(tx);
    });

    const result = await consumeApprovalToken({ signedToken: "tok-1.sig" });
    expect(result.success).toBe(true);
    expect(advanceWorkflow).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ userId: "hr-1" }),
      3,
      expect.anything()
    );
  });

  it("returns success false and relies on transaction rollback when version mismatches", async () => {
    findUniqueToken.mockResolvedValue({
      id: "tok-1",
      leaveRequestId: 10,
      approvalStepId: 20,
      approverUserId: "hr-1",
      metadata: JSON.stringify({ leaveVersion: 0 }),
      leaveRequest: { version: 1 },
    });

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        approvalToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      advanceWorkflow.mockRejectedValue(
        new WorkflowError("This request was updated by another user. Please refresh and try again.")
      );
      return fn(tx);
    });

    const result = await consumeApprovalToken({ signedToken: "tok-1.sig" });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/updated by another user/i);
    expect(advanceWorkflow).toHaveBeenCalledWith(
      10,
      expect.anything(),
      0,
      expect.anything()
    );
  });

  it("falls back to the live leave version when metadata has no snapshot", async () => {
    findUniqueToken.mockResolvedValue({
      id: "tok-1",
      leaveRequestId: 10,
      approvalStepId: 20,
      approverUserId: "hr-1",
      metadata: "{}",
      leaveRequest: { version: 6 },
    });

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        approvalToken: {
          updateMany: vi
            .fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValue({ count: 0 }),
        },
      };
      advanceWorkflow.mockResolvedValue({
        leaveId: 10,
        workflowStatus: "approved",
        message: "ok",
      });
      return fn(tx);
    });

    await consumeApprovalToken({ signedToken: "tok-1.sig" });
    expect(advanceWorkflow).toHaveBeenCalledWith(
      10,
      expect.anything(),
      6,
      expect.anything()
    );
  });

  it("rejects already-consumed tokens before workflow mutation", async () => {
    findUniqueToken.mockResolvedValue({
      id: "tok-1",
      leaveRequestId: 10,
      approvalStepId: 20,
      approverUserId: "hr-1",
      metadata: JSON.stringify({ leaveVersion: 1 }),
      leaveRequest: { version: 1 },
    });

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        approvalToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      return fn(tx);
    });

    const result = await consumeApprovalToken({ signedToken: "tok-1.sig" });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already been used/i);
    expect(advanceWorkflow).not.toHaveBeenCalled();
  });
});
