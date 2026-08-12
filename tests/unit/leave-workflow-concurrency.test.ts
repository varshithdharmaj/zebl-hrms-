import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApprovalStepStatus,
  ApproverRole,
  LeaveWorkflowStatus,
} from "@/generated/prisma/client";

const emitWorkflowNotification = vi.fn(async () => undefined);
const writeAuditLog = vi.fn(async () => undefined);
const processPendingLeaveAccruals = vi.fn(async () => ({
  joiningDate: new Date("2020-01-01"),
}));
const deductLeaveForApproval = vi.fn(async () => undefined);
const canUserApproveStep = vi.fn(() => true);
const canUserRejectStep = vi.fn(() => true);

vi.mock("@/lib/workflow/notification-hooks", () => ({
  emitWorkflowNotification: (...args: unknown[]) => emitWorkflowNotification(...args),
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    LEAVE_STEP_APPROVED: "leave.step_approved",
    LEAVE_STATUS_CHANGED: "leave.status_changed",
    LEAVE_REJECTED: "leave.rejected",
    LEAVE_WITHDRAWN: "leave.withdrawn",
    LEAVE_CANCELLED: "leave.cancelled",
    LEAVE_SUBMITTED: "leave.submitted",
  },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

vi.mock("@/lib/leave", () => ({
  countLeaveDays: () => 2,
  processPendingLeaveAccruals: (...args: unknown[]) => processPendingLeaveAccruals(...args),
  deductLeaveForApproval: (...args: unknown[]) => deductLeaveForApproval(...args),
  restoreLeaveBalanceForCancellation: vi.fn(async () => undefined),
}));

vi.mock("@/lib/workflow/step-authorization", () => ({
  canUserApproveStep: (...args: unknown[]) => canUserApproveStep(...args),
  canUserRejectStep: (...args: unknown[]) => canUserRejectStep(...args),
  isSuperAdminWorkflowOverride: () => false,
}));

vi.mock("@/lib/permissions", () => ({
  canAccessAdmin: (role: string) => role === "hr" || role === "super_admin",
}));

vi.mock("@/lib/leave/leave-request-include", () => ({
  leaveRequestWithStepsInclude: {},
}));

const leaveRequestUpdateMany = vi.fn();
const leaveRequestUpdate = vi.fn();
const leaveRequestFindUnique = vi.fn();
const leaveApprovalStepUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leaveRequest: {
      findUnique: (...args: unknown[]) => leaveRequestFindUnique(...args),
      updateMany: (...args: unknown[]) => leaveRequestUpdateMany(...args),
      update: (...args: unknown[]) => leaveRequestUpdate(...args),
    },
    leaveApprovalStep: {
      updateMany: (...args: unknown[]) => leaveApprovalStepUpdateMany(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        leaveRequest: {
          findUnique: (...args: unknown[]) => leaveRequestFindUnique(...args),
          updateMany: (...args: unknown[]) => leaveRequestUpdateMany(...args),
          update: (...args: unknown[]) => leaveRequestUpdate(...args),
        },
        leaveApprovalStep: {
          updateMany: (...args: unknown[]) => leaveApprovalStepUpdateMany(...args),
        },
      };
      return fn(tx);
    },
  },
}));

import { advanceWorkflow, WorkflowError } from "@/lib/workflow/leave-workflow";

const actor = {
  userId: "u-mgr",
  email: "mgr@test.local",
  role: "employee" as const,
  employeeId: 50,
};

function pendingLeave(version = 3) {
  const stepId = 10;
  return {
    id: 1,
    employeeId: 200,
    leaveType: "CL",
    startDate: new Date("2026-08-01"),
    endDate: new Date("2026-08-02"),
    days: 2,
    reason: "Trip",
    workflowStatus: LeaveWorkflowStatus.pending_approval,
    status: "pending",
    version,
    currentStepId: stepId,
    currentStep: {
      id: stepId,
      stepOrder: 1,
      approverId: 50,
      approverRole: ApproverRole.team_lead,
      status: ApprovalStepStatus.pending,
      approver: { name: "Mgr" },
    },
    approvalSteps: [
      {
        id: stepId,
        stepOrder: 1,
        approverId: 50,
        approverRole: ApproverRole.team_lead,
        status: ApprovalStepStatus.pending,
        approver: { name: "Mgr" },
      },
    ],
    employee: { name: "Emp", employeeCode: "E1" },
  };
}

describe("advanceWorkflow concurrency claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canUserApproveStep.mockReturnValue(true);
    leaveRequestUpdateMany.mockResolvedValue({ count: 1 });
    leaveApprovalStepUpdateMany.mockResolvedValue({ count: 1 });
    leaveRequestUpdate.mockResolvedValue({});
    processPendingLeaveAccruals.mockResolvedValue({ joiningDate: new Date("2020-01-01") });
    deductLeaveForApproval.mockResolvedValue(undefined);
  });

  it("Case 1 — final approve claims version+pending status, deducts once, marks approved", async () => {
    const leave = pendingLeave(5);
    leaveRequestFindUnique
      .mockResolvedValueOnce(leave) // loadLeaveWithSteps
      .mockResolvedValueOnce(leave); // fresh inside TX

    const result = await advanceWorkflow(1, actor, 5);

    expect(result.workflowStatus).toBe(LeaveWorkflowStatus.approved);
    expect(leaveRequestUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        version: 5,
        workflowStatus: LeaveWorkflowStatus.pending_approval,
      },
      data: { version: { increment: 1 } },
    });
    expect(leaveApprovalStepUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, status: ApprovalStepStatus.pending },
      })
    );
    expect(processPendingLeaveAccruals).toHaveBeenCalledWith(200, expect.anything());
    expect(deductLeaveForApproval).toHaveBeenCalledTimes(1);
    expect(deductLeaveForApproval).toHaveBeenCalledWith(
      expect.objectContaining({ leaveRequestId: 1, days: 2, tx: expect.anything() })
    );
  });

  it("Case 2 — duplicate approval: second version claim fails (no deduction)", async () => {
    const leave = pendingLeave(2);
    leaveRequestFindUnique.mockResolvedValue(leave);
    leaveRequestUpdateMany.mockResolvedValue({ count: 0 });

    await expect(advanceWorkflow(1, actor, 2)).rejects.toThrow(WorkflowError);
    await expect(advanceWorkflow(1, actor, 2)).rejects.toThrow(/updated by another user/);

    expect(deductLeaveForApproval).not.toHaveBeenCalled();
    expect(processPendingLeaveAccruals).not.toHaveBeenCalled();
  });

  it("Case 2b — step already actioned: version claimed but step claim fails", async () => {
    const leave = pendingLeave(1);
    leaveRequestFindUnique.mockResolvedValue(leave);
    leaveRequestUpdateMany.mockResolvedValue({ count: 1 });
    leaveApprovalStepUpdateMany.mockResolvedValue({ count: 0 });

    await expect(advanceWorkflow(1, actor, 1)).rejects.toThrow(/already actioned/);
    expect(deductLeaveForApproval).not.toHaveBeenCalled();
  });

  it("Case 8 — unauthorized actor cannot approve", async () => {
    const leave = pendingLeave(0);
    leaveRequestFindUnique.mockResolvedValue(leave);
    canUserApproveStep.mockReturnValue(false);

    await expect(advanceWorkflow(1, actor, 0)).rejects.toThrow(/not authorized/);
    expect(leaveRequestUpdateMany).not.toHaveBeenCalled();
    expect(deductLeaveForApproval).not.toHaveBeenCalled();
  });

  it("maps insufficient-balance domain error to WorkflowError (no silent success)", async () => {
    const leave = pendingLeave(4);
    leaveRequestFindUnique.mockResolvedValueOnce(leave).mockResolvedValueOnce(leave);
    deductLeaveForApproval.mockRejectedValue(
      new Error("Insufficient CL balance. Available balance is less than required: 2")
    );

    await expect(advanceWorkflow(1, actor, 4)).rejects.toThrow(WorkflowError);
    await expect(advanceWorkflow(1, actor, 4)).rejects.toThrow(/Insufficient CL balance/);
  });

  it("passes expectedVersion into atomic claim (token / double-submit path)", async () => {
    const leave = pendingLeave(9);
    leaveRequestFindUnique.mockResolvedValueOnce(leave).mockResolvedValueOnce(leave);

    await advanceWorkflow(1, actor, 9);

    expect(leaveRequestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ version: 9 }),
      })
    );
  });
});
