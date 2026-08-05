import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveWorkflowStatus } from "@/generated/prisma/enums";

const callOrder: string[] = [];
const emitWorkflowNotification = vi.fn(async () => {
  callOrder.push("emit");
});

const mockTx = {
  leaveRequest: {
    create: vi.fn(),
    update: vi.fn(),
  },
  leaveApprovalStep: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/workflow/notification-hooks", () => ({
  emitWorkflowNotification: (...args: unknown[]) => emitWorkflowNotification(...args),
}));

vi.mock("@/lib/workflow/approval-routing", () => ({
  buildApprovalChain: vi.fn(async () => [
    { stepOrder: 1, approverId: null, approverRole: "hr_admin" },
  ]),
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: { LEAVE_SUBMITTED: "leave.submitted" },
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
      callOrder.push("tx-start");
      const result = await fn(mockTx);
      callOrder.push("tx-committed");
      return result;
    },
  },
}));

vi.mock("@/lib/leave/leave-request-include", () => ({
  leaveRequestWithStepsInclude: {},
}));

import { createLeaveWorkflow } from "@/lib/workflow/leave-workflow";

describe("workflow notifications after commit", () => {
  beforeEach(() => {
    callOrder.length = 0;
    vi.clearAllMocks();
    mockTx.leaveRequest.create.mockResolvedValue({ id: 42 });
    mockTx.leaveRequest.update.mockResolvedValue({});
    mockTx.leaveApprovalStep.create.mockResolvedValue({ id: 100 });
  });

  it("emits submitted notification only after the create transaction commits", async () => {
    await createLeaveWorkflow({
      employeeId: 1,
      leaveType: "CL",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-01"),
      days: 1,
      reason: "Personal day off",
      actor: {
        userId: "u1",
        email: "e@test.local",
        role: "employee",
        employeeId: 1,
      },
    });

    expect(callOrder).toEqual(["tx-start", "tx-committed", "emit"]);
    expect(emitWorkflowNotification).toHaveBeenCalledTimes(1);
    expect(emitWorkflowNotification).toHaveBeenCalledWith({
      leaveRequestId: 42,
      event: "submitted",
      workflowStatus: LeaveWorkflowStatus.pending_approval,
    });
  });
});
