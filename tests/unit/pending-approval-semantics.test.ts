import { describe, expect, it, vi } from "vitest";
import {
  countCurrentActionableApprovalSteps,
  countMyPendingApprovalsForHr,
  countMyPendingApprovalsForManager,
  countOpenApprovalSteps,
  countPendingLeaveRequests,
  isCurrentActionableApprovalStep,
  type ApprovalStepLike,
  type LeaveRequestLike,
} from "@/lib/workflow/pending-approval-semantics";
import { countOrgCurrentPendingApprovals } from "@/lib/analytics/workforce-metrics";

const MANAGER_A = 10;
const MANAGER_B = 20;

function leave(
  id: number,
  currentStepId: number | null,
  workflowStatus = "pending_approval"
): LeaveRequestLike {
  return { id, currentStepId, workflowStatus };
}

function step(
  id: number,
  leaveRequestId: number,
  opts: { status?: string; approverId?: number | null; approverRole?: string } = {}
): ApprovalStepLike {
  return {
    id,
    leaveRequestId,
    status: opts.status ?? "pending",
    approverId: opts.approverId ?? null,
    approverRole: opts.approverRole ?? "manager",
  };
}

describe("pending approval semantics — three distinct concepts", () => {
  it("Test 1 — single-step: all three counts are 1", () => {
    const leaves = [leave(1, 101)];
    const steps = [step(101, 1, { approverId: MANAGER_A })];

    expect(countMyPendingApprovalsForManager(steps, leaves, MANAGER_A)).toBe(1);
    expect(countPendingLeaveRequests(leaves)).toBe(1);
    expect(countOpenApprovalSteps(steps)).toBe(1);
    expect(countCurrentActionableApprovalSteps(steps, leaves)).toBe(1);
  });

  it("Test 2 — multi-step: My Pending / Requests = 1, Open Steps = 3", () => {
    const leaves = [leave(1, 101)];
    const steps = [
      step(101, 1, { approverId: MANAGER_A, approverRole: "manager" }),
      step(102, 1, { approverId: null, approverRole: "hr_admin" }),
      step(103, 1, { approverId: 99, approverRole: "skip_level_manager" }),
    ];

    expect(countPendingLeaveRequests(leaves)).toBe(1);
    expect(countOpenApprovalSteps(steps)).toBe(3);
    expect(countCurrentActionableApprovalSteps(steps, leaves)).toBe(1);
    expect(countMyPendingApprovalsForManager(steps, leaves, MANAGER_A)).toBe(1);
    expect(countMyPendingApprovalsForHr(steps, leaves)).toBe(0);
  });

  it("Test 3 — after manager advances: HR becomes actionable; open steps = 2", () => {
    const leaves = [leave(1, 102)];
    const steps = [
      step(101, 1, { status: "approved", approverId: MANAGER_A, approverRole: "manager" }),
      step(102, 1, { status: "pending", approverId: null, approverRole: "hr_admin" }),
      step(103, 1, { status: "pending", approverId: 99, approverRole: "skip_level_manager" }),
    ];

    expect(countMyPendingApprovalsForManager(steps, leaves, MANAGER_A)).toBe(0);
    expect(countMyPendingApprovalsForHr(steps, leaves)).toBe(1);
    expect(countPendingLeaveRequests(leaves)).toBe(1);
    expect(countOpenApprovalSteps(steps)).toBe(2);
    expect(countCurrentActionableApprovalSteps(steps, leaves)).toBe(1);
  });

  it("Test 4 — completed workflow: all three counts are 0", () => {
    const leaves = [leave(1, null, "approved")];
    const steps = [
      step(101, 1, { status: "approved", approverId: MANAGER_A }),
      step(102, 1, { status: "approved", approverRole: "hr_admin" }),
      step(103, 1, { status: "approved", approverId: 99 }),
    ];

    expect(countMyPendingApprovalsForManager(steps, leaves, MANAGER_A)).toBe(0);
    expect(countMyPendingApprovalsForHr(steps, leaves)).toBe(0);
    expect(countPendingLeaveRequests(leaves)).toBe(0);
    expect(countOpenApprovalSteps(steps)).toBe(0);
    expect(countCurrentActionableApprovalSteps(steps, leaves)).toBe(0);
  });

  it("Test 5 — future pending step is open but not actionable", () => {
    const leaves = [leave(1, 101)];
    const future = step(102, 1, { approverRole: "hr_admin" });

    expect(isCurrentActionableApprovalStep(future, leaves[0]!)).toBe(false);
    expect(countOpenApprovalSteps([future])).toBe(1);
    expect(countCurrentActionableApprovalSteps([future], leaves)).toBe(0);
  });

  it("Test 6 — actor isolation between managers", () => {
    const leaves = [leave(1, 101), leave(2, 201)];
    const steps = [
      step(101, 1, { approverId: MANAGER_A }),
      step(201, 2, { approverId: MANAGER_B }),
    ];

    expect(countMyPendingApprovalsForManager(steps, leaves, MANAGER_A)).toBe(1);
    expect(countMyPendingApprovalsForManager(steps, leaves, MANAGER_B)).toBe(1);
    expect(countMyPendingApprovalsForManager(steps, leaves, 999)).toBe(0);
  });

  it("Test 7 — future HR step is not HR-actionable until current", () => {
    const leaves = [leave(1, 101)];
    const steps = [
      step(101, 1, { approverId: MANAGER_A, approverRole: "manager" }),
      step(102, 1, { approverRole: "hr_admin" }),
    ];

    expect(countMyPendingApprovalsForHr(steps, leaves)).toBe(0);

    const advanced = [leave(1, 102)];
    const after = [
      step(101, 1, { status: "approved", approverId: MANAGER_A }),
      step(102, 1, { approverRole: "hr_admin" }),
    ];
    expect(countMyPendingApprovalsForHr(after, advanced)).toBe(1);
  });
});

describe("countOrgCurrentPendingApprovals — analytics PENDING_APPROVALS query", () => {
  it("uses currentForLeave + pending_approval (not bare status:pending)", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const client = { leaveApprovalStep: { count } };

    const value = await countOrgCurrentPendingApprovals(client as never);
    expect(value).toBe(1);
    expect(count).toHaveBeenCalledWith({
      where: {
        status: "pending",
        currentForLeave: {
          is: {
            workflowStatus: "pending_approval",
          },
        },
      },
    });
  });

  it("Test 8 — organization scope has no approverId filter (not a personal inbox)", async () => {
    const count = vi.fn().mockResolvedValue(0);
    await countOrgCurrentPendingApprovals({ leaveApprovalStep: { count } } as never);
    const where = count.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where).not.toHaveProperty("approverId");
    expect(where).toHaveProperty("currentForLeave");
  });
});
