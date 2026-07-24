import { describe, expect, it } from "vitest";
import {
  ApprovalStepStatus,
  ApproverRole,
  LeaveWorkflowStatus,
} from "@/generated/prisma/client";
import {
  canUserApproveStep,
  canUserRejectStep,
  isSuperAdminWorkflowOverride,
  type LeaveStepAuthLeave,
} from "@/lib/workflow/step-authorization";
import type { WorkflowActor } from "@/lib/workflow/workflow-types";

const hrActor: WorkflowActor = {
  userId: "hr-1",
  email: "hr@test.local",
  role: "hr",
  employeeId: 100,
};

const saActor: WorkflowActor = {
  userId: "sa-1",
  email: "sa@test.local",
  role: "super_admin",
  employeeId: null,
};

const managerActor: WorkflowActor = {
  userId: "mgr-1",
  email: "mgr@test.local",
  role: "employee",
  employeeId: 50,
};

const employeeActor: WorkflowActor = {
  userId: "emp-1",
  email: "emp@test.local",
  role: "employee",
  employeeId: 200,
};

function leaveAtStep(params: {
  stepRole: string;
  approverId: number | null;
  employeeId?: number;
  workflowStatus?: LeaveWorkflowStatus;
}): LeaveStepAuthLeave {
  const stepId = 10;
  return {
    employeeId: params.employeeId ?? 200,
    workflowStatus: params.workflowStatus ?? LeaveWorkflowStatus.pending_approval,
    currentStepId: stepId,
    approvalSteps: [
      {
        id: stepId,
        stepOrder: 1,
        status: ApprovalStepStatus.pending,
        approverRole: params.stepRole,
        approverId: params.approverId,
      },
    ],
  };
}

describe("canUserApproveStep", () => {
  it("HR can approve hr_admin step", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.hr_admin,
      approverId: null,
    });
    expect(canUserApproveStep(hrActor, leave)).toBe(true);
  });

  it("HR cannot approve manager pending step", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.manager,
      approverId: 50,
    });
    expect(canUserApproveStep(hrActor, leave)).toBe(false);
  });

  it("HR cannot approve skip_level_manager pending step", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.skip_level_manager,
      approverId: 50,
    });
    expect(canUserApproveStep(hrActor, leave)).toBe(false);
  });

  it("Superadmin can approve hr_admin step", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.hr_admin,
      approverId: null,
    });
    expect(canUserApproveStep(saActor, leave)).toBe(true);
  });

  it("Superadmin can approve manager step (override path)", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.manager,
      approverId: 50,
    });
    expect(canUserApproveStep(saActor, leave)).toBe(true);
  });

  it("designated manager can approve their step", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.manager,
      approverId: 50,
    });
    expect(canUserApproveStep(managerActor, leave)).toBe(true);
  });

  it("non-designated employee cannot approve manager step", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.manager,
      approverId: 50,
    });
    expect(canUserApproveStep(employeeActor, leave)).toBe(false);
  });

  it("requester cannot approve own leave", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.hr_admin,
      approverId: null,
      employeeId: 100,
    });
    expect(canUserApproveStep(hrActor, leave)).toBe(false);
  });
});

describe("canUserRejectStep — same boundary as approve", () => {
  it("HR can reject hr_admin step", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.hr_admin,
      approverId: null,
    });
    expect(canUserRejectStep(hrActor, leave)).toBe(true);
  });

  it("HR cannot reject manager pending step", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.manager,
      approverId: 50,
    });
    expect(canUserRejectStep(hrActor, leave)).toBe(false);
    expect(canUserRejectStep(hrActor, leave)).toBe(
      canUserApproveStep(hrActor, leave)
    );
  });

  it("Superadmin can reject manager step", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.manager,
      approverId: 50,
    });
    expect(canUserRejectStep(saActor, leave)).toBe(true);
  });

  it("reject mirrors approve for all actors/steps in matrix", () => {
    const cases: Array<{ actor: WorkflowActor; leave: LeaveStepAuthLeave }> = [
      {
        actor: hrActor,
        leave: leaveAtStep({ stepRole: ApproverRole.hr_admin, approverId: null }),
      },
      {
        actor: hrActor,
        leave: leaveAtStep({ stepRole: ApproverRole.manager, approverId: 50 }),
      },
      {
        actor: saActor,
        leave: leaveAtStep({ stepRole: ApproverRole.manager, approverId: 50 }),
      },
      {
        actor: managerActor,
        leave: leaveAtStep({ stepRole: ApproverRole.manager, approverId: 50 }),
      },
      {
        actor: employeeActor,
        leave: leaveAtStep({ stepRole: ApproverRole.hr_admin, approverId: null }),
      },
    ];

    for (const { actor, leave } of cases) {
      expect(canUserRejectStep(actor, leave)).toBe(canUserApproveStep(actor, leave));
    }
  });
});

describe("isSuperAdminWorkflowOverride", () => {
  it("false for HR on hr_admin", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.hr_admin,
      approverId: null,
    });
    expect(isSuperAdminWorkflowOverride(hrActor, leave)).toBe(false);
  });

  it("false for Superadmin on hr_admin (normal admin path)", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.hr_admin,
      approverId: null,
    });
    expect(isSuperAdminWorkflowOverride(saActor, leave)).toBe(false);
  });

  it("true for Superadmin on manager step they are not assigned to", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.manager,
      approverId: 50,
    });
    expect(isSuperAdminWorkflowOverride(saActor, leave)).toBe(true);
  });

  it("false when Superadmin is the designated manager approver", () => {
    const saAsManager: WorkflowActor = {
      ...saActor,
      employeeId: 50,
    };
    const leave = leaveAtStep({
      stepRole: ApproverRole.manager,
      approverId: 50,
    });
    expect(isSuperAdminWorkflowOverride(saAsManager, leave)).toBe(false);
  });

  it("true for Superadmin on skip_level step", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.skip_level_manager,
      approverId: 99,
    });
    expect(isSuperAdminWorkflowOverride(saActor, leave)).toBe(true);
  });
});

describe("audit metadata flags (policy helpers)", () => {
  it("normal HR approval → superAdminOverride false", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.hr_admin,
      approverId: null,
    });
    expect(canUserApproveStep(hrActor, leave)).toBe(true);
    expect(isSuperAdminWorkflowOverride(hrActor, leave)).toBe(false);
  });

  it("SA override approval → superAdminOverride true", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.manager,
      approverId: 50,
    });
    expect(canUserApproveStep(saActor, leave)).toBe(true);
    expect(isSuperAdminWorkflowOverride(saActor, leave)).toBe(true);
  });

  it("SA normal hr_admin approval → superAdminOverride false", () => {
    const leave = leaveAtStep({
      stepRole: ApproverRole.hr_admin,
      approverId: null,
    });
    expect(canUserApproveStep(saActor, leave)).toBe(true);
    expect(isSuperAdminWorkflowOverride(saActor, leave)).toBe(false);
  });
});
