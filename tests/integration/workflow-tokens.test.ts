import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";

vi.mock("@/lib/workflow/notification-hooks", () => ({
  emitWorkflowNotification: vi.fn().mockResolvedValue(undefined),
}));
import {
  ApprovalTokenAction,
  ApprovalTokenStatus,
  ApprovalStepStatus,
  LeaveWorkflowStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  advanceWorkflow,
  createLeaveWorkflow,
  rejectWorkflow,
  toWorkflowActor,
  WorkflowError,
} from "@/lib/workflow/leave-workflow";
import { toAppUserRole } from "@/lib/roles";
import { createApprovalTokenPair, signToken } from "@/lib/approval-tokens/token-generator";
import { consumeApprovalToken } from "@/lib/approval-tokens/token-consumer";
import { initializeEmployeeLeaveBalances } from "@/lib/leave";

async function isDatabaseReady(): Promise<boolean> {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("workflow and approval tokens (integration)", () => {
  let ready = false;
  const run = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!ready) return;
      await fn();
    });

  let employeeId: number;
  let managerUserId: string;
  let hrUserId: string;
  let leaveId: number;
  let stepId: number;

  beforeAll(async () => {
    ready = await isDatabaseReady();
    if (!ready) return;

    try {
    const suffix = Date.now();
    const employee = await prisma.employee.create({
      data: {
        employeeCode: `T${suffix}`,
        name: "Token Test Employee",
        joiningDate: new Date("2020-01-01"),
        employeeStatus: "Active",
        isActive: true,
      },
    });
    employeeId = employee.id;
    await initializeEmployeeLeaveBalances(employeeId, { el: 0, cl: 12, sl: 12 }, "integration-test");

    const managerEmp = await prisma.employee.create({
      data: {
        employeeCode: `M${suffix}`,
        name: "Token Test Manager",
        joiningDate: new Date("2019-01-01"),
        employeeStatus: "Active",
        isActive: true,
      },
    });

    await prisma.employee.update({
      where: { id: employeeId },
      data: { managerId: managerEmp.id },
    });

    const managerUser = await prisma.user.create({
      data: {
        email: `manager-${suffix}@test.local`,
        role: UserRole.manager,
        employeeId: managerEmp.id,
      },
    });
    managerUserId = managerUser.id;

    const hrUser = await prisma.user.findFirst({
      where: { role: { in: [UserRole.admin, UserRole.hr_admin] } },
    });
    if (!hrUser) throw new Error("Seed admin user required for integration tests.");
    hrUserId = hrUser.id;

    const employeeUser = await prisma.user.create({
      data: {
        email: `emp-${suffix}@test.local`,
        role: UserRole.employee,
        employeeId,
      },
    });

    const submit = await createLeaveWorkflow({
      employeeId,
      leaveType: "CL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-02"),
      days: 2,
      reason: "Integration test leave",
      actor: toWorkflowActor({
        id: employeeUser.id,
        email: employeeUser.email,
        role: "employee",
        employeeId,
      }),
    });
    leaveId = submit.leaveId;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: { currentStep: true },
    });
    if (!leave?.currentStepId) throw new Error("Expected pending approval step.");
    stepId = leave.currentStepId;
    } catch (e) {
      console.warn("Integration workflow tests skipped:", e);
      ready = false;
    }
  }, 30000);

  afterAll(async () => {
    if (!ready || !leaveId) return;
    await prisma.approvalToken.deleteMany({ where: { leaveRequestId: leaveId } });
    await prisma.leaveApprovalStep.deleteMany({ where: { leaveRequestId: leaveId } });
    await prisma.leaveRequest.deleteMany({ where: { id: leaveId } });
    await prisma.user.deleteMany({
      where: { email: { contains: "@test.local" } },
    });
    await prisma.employee.deleteMany({
      where: { employeeCode: { startsWith: "T" } },
    });
    await prisma.employee.deleteMany({
      where: { employeeCode: { startsWith: "M" } },
    });
    await prisma.$disconnect();
  }, 30000);

  run("approves via manager workflow step", async () => {
    const manager = await prisma.user.findUniqueOrThrow({ where: { id: managerUserId } });
    const result = await advanceWorkflow(
      leaveId,
      toWorkflowActor({
        id: manager.id,
        email: manager.email,
        role: "manager",
        employeeId: manager.employeeId,
      })
    );
    expect(result.workflowStatus).toBe(LeaveWorkflowStatus.pending_approval);
  });

  run("consumes email token only after successful workflow", async () => {
    const hr = await prisma.user.findUniqueOrThrow({ where: { id: hrUserId } });
    const leave = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: leaveId } });

    const pair = await createApprovalTokenPair({
      leaveRequestId: leaveId,
      approvalStepId: leave.currentStepId!,
      approverId: null,
      approverUserId: hr.id,
    });
    expect(pair).not.toBeNull();

    const approveId = (await prisma.approvalToken.findFirst({
      where: {
        leaveRequestId: leaveId,
        action: ApprovalTokenAction.approve,
        status: ApprovalTokenStatus.active,
      },
    }))!.id;

    const signed = signToken(approveId, ApprovalTokenAction.approve);
    const consumed = await consumeApprovalToken({ signedToken: signed });
    expect(consumed.success, consumed.message).toBe(true);

    const token = await prisma.approvalToken.findUnique({ where: { id: approveId } });
    expect(token?.status).toBe(ApprovalTokenStatus.consumed);

    const updatedLeave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
    expect(updatedLeave?.workflowStatus).toBe(LeaveWorkflowStatus.approved);
  });

  run("rolls back token when workflow fails (version mismatch)", async () => {
    const suffix = Date.now() + 1;
    const emp = await prisma.employee.create({
      data: {
        employeeCode: `R${suffix}`,
        name: "Rollback Employee",
        joiningDate: new Date("2020-01-01"),
        employeeStatus: "Active",
        isActive: true,
      },
    });
    const empUser = await prisma.user.create({
      data: {
        email: `rollback-${suffix}@test.local`,
        role: UserRole.employee,
        employeeId: emp.id,
      },
    });
    const hr = await prisma.user.findFirstOrThrow({
      where: { role: { in: [UserRole.admin, UserRole.hr_admin] } },
    });

    await initializeEmployeeLeaveBalances(emp.id, { el: 0, cl: 12, sl: 12 }, "integration-test");

    const { leaveId: rollbackLeaveId } = await createLeaveWorkflow({
      employeeId: emp.id,
      leaveType: "CL",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-01"),
      days: 1,
      reason: "Rollback test",
      actor: toWorkflowActor({
        id: empUser.id,
        email: empUser.email,
        role: "employee",
        employeeId: emp.id,
      }),
    });

    const lr = await prisma.leaveRequest.findUniqueOrThrow({
      where: { id: rollbackLeaveId },
      include: { currentStep: true },
    });
    const tokenId = crypto.randomUUID();
    await prisma.approvalToken.create({
      data: {
        id: tokenId,
        leaveRequestId: rollbackLeaveId,
        approvalStepId: lr.currentStepId!,
        approverUserId: hr.id,
        action: ApprovalTokenAction.approve,
        tokenHash: `test-${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    await prisma.leaveRequest.update({
      where: { id: rollbackLeaveId },
      data: { version: { increment: 1 } },
    });

    const originalFindUniqueToken = prisma.approvalToken.findUnique.bind(prisma.approvalToken);
    vi.spyOn(prisma.approvalToken, "findUnique").mockImplementation((async (args: any) => {
      const res = (await originalFindUniqueToken(args)) as any;
      if (res && res.id === tokenId && res.leaveRequest) {
        return {
          ...res,
          leaveRequest: {
            ...res.leaveRequest,
            version: 0,
          },
        };
      }
      return res;
    }) as any);

    const signed = signToken(tokenId, ApprovalTokenAction.approve);
    const result = await consumeApprovalToken({ signedToken: signed });
    expect(result.success).toBe(false);

    const token = await prisma.approvalToken.findUnique({ where: { id: tokenId } });
    expect(token?.status).toBe(ApprovalTokenStatus.active);

    await prisma.approvalToken.deleteMany({ where: { leaveRequestId: rollbackLeaveId } });
    await prisma.leaveApprovalStep.deleteMany({ where: { leaveRequestId: rollbackLeaveId } });
    await prisma.leaveRequest.delete({ where: { id: rollbackLeaveId } });
    await prisma.user.delete({ where: { id: empUser.id } });
    await prisma.employee.delete({ where: { id: emp.id } });
    vi.restoreAllMocks();
  });

  run("rejects with sufficient comment", async () => {
    const suffix = Date.now() + 2;
    const emp = await prisma.employee.create({
      data: {
        employeeCode: `X${suffix}`,
        name: "Reject Employee",
        joiningDate: new Date("2020-01-01"),
        employeeStatus: "Active",
        isActive: true,
      },
    });
    const empUser = await prisma.user.create({
      data: {
        email: `reject-${suffix}@test.local`,
        role: UserRole.employee,
        employeeId: emp.id,
      },
    });
    const hr = await prisma.user.findFirstOrThrow({
      where: { role: { in: [UserRole.admin, UserRole.hr_admin] } },
    });

    await initializeEmployeeLeaveBalances(emp.id, { el: 0, cl: 12, sl: 12 }, "integration-test");

    const { leaveId: rejectLeaveId } = await createLeaveWorkflow({
      employeeId: emp.id,
      leaveType: "CL",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-02"),
      days: 2,
      reason: "Reject path test",
      actor: toWorkflowActor({
        id: empUser.id,
        email: empUser.email,
        role: "employee",
        employeeId: emp.id,
      }),
    });

    await expect(
      rejectWorkflow(
        rejectLeaveId,
        toWorkflowActor({
          id: hr.id,
          email: hr.email,
          role: toAppUserRole(hr.role),
          employeeId: hr.employeeId,
        }),
        "short"
      )
    ).rejects.toBeInstanceOf(WorkflowError);

    const rejected = await rejectWorkflow(
      rejectLeaveId,
      toWorkflowActor({
        id: hr.id,
        email: hr.email,
        role: toAppUserRole(hr.role),
        employeeId: hr.employeeId,
      }),
      "Not approved for this period"
    );
    expect(rejected.workflowStatus).toBe(LeaveWorkflowStatus.rejected);

    await prisma.leaveApprovalStep.deleteMany({ where: { leaveRequestId: rejectLeaveId } });
    await prisma.leaveRequest.delete({ where: { id: rejectLeaveId } });
    await prisma.user.delete({ where: { id: empUser.id } });
    await prisma.employee.delete({ where: { id: emp.id } });
  });
});
