/**
 * Cross-manager isolation for the two test line-manager accounts.
 * Managers are UserRole.employee; scope is Employee.managerId / PeopleScopeEngine.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApprovalStepStatus,
  ApproverRole,
  LeaveWorkflowStatus,
} from "@/generated/prisma/client";
import { PermissionError, canAccessAdmin, canAccessEmployeeShell } from "@/lib/permissions";
import { PeopleScopeEngine } from "@/lib/people-scope/engine";
import { canUserApproveStep } from "@/lib/workflow/step-authorization";
import type { LeaveStepAuthLeave } from "@/lib/workflow/step-authorization";
import type { WorkflowActor } from "@/lib/workflow/workflow-types";
import {
  mockTestManager1Session,
  mockTestManager2Session,
} from "../fixtures/session";

const findMany = vi.fn();
const count = vi.fn();
const findFirst = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
      findFirst: (...args: unknown[]) => findFirst(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

vi.mock("@/lib/org", () => ({
  detectCircularManagerRelationship: vi.fn(async () => false),
}));

const MGR1_EMP_ID = 101;
const MGR2_EMP_ID = 102;
const EMP_A1 = 201;
const EMP_A2 = 202;
const EMP_B1 = 301;
const EMP_B2 = 302;

function managerActor(employeeId: number): WorkflowActor {
  return { role: "employee", employeeId };
}

function leaveForReport(opts: {
  employeeId: number;
  approverId: number;
}): LeaveStepAuthLeave {
  const stepId = 1;
  return {
    employeeId: opts.employeeId,
    workflowStatus: LeaveWorkflowStatus.pending_approval,
    currentStepId: stepId,
    approvalSteps: [
      {
        id: stepId,
        stepOrder: 1,
        status: ApprovalStepStatus.pending,
        approverRole: ApproverRole.manager,
        approverId: opts.approverId,
      },
    ],
  };
}

describe("test manager accounts — auth / RBAC shape", () => {
  it("Manager 1 session is employee role (not hr/super_admin)", () => {
    const s = mockTestManager1Session(MGR1_EMP_ID);
    expect(s.role).toBe("employee");
    expect(s.email).toBe("mgr1.test@zebl.local");
    expect(canAccessEmployeeShell(s.role)).toBe(true);
    expect(canAccessAdmin(s.role)).toBe(false);
  });

  it("Manager 2 session is employee role (not hr/super_admin)", () => {
    const s = mockTestManager2Session(MGR2_EMP_ID);
    expect(s.role).toBe("employee");
    expect(s.email).toBe("mgr2.test@zebl.local");
    expect(canAccessEmployeeShell(s.role)).toBe(true);
    expect(canAccessAdmin(s.role)).toBe(false);
  });
});

describe("test manager accounts — employee visibility isolation", () => {
  beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
    findFirst.mockReset();
    findUnique.mockReset();
  });

  it("Manager 1 resolveScope returns only Team A report IDs", async () => {
    findMany.mockResolvedValue([
      { id: EMP_A1, department: "Test Team A" },
      { id: EMP_A2, department: "Test Team A" },
    ]);
    const scope = await PeopleScopeEngine.resolveScope(MGR1_EMP_ID);
    expect(scope.employeeIds).toEqual([EMP_A1, EMP_A2]);
    expect(scope.departments).toEqual(["Test Team A"]);
    expect(scope.employeeIds).not.toContain(EMP_B1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ managerId: MGR1_EMP_ID }),
      })
    );
  });

  it("Manager 2 resolveScope returns only Team B report IDs", async () => {
    findMany.mockResolvedValue([
      { id: EMP_B1, department: "Test Team B" },
      { id: EMP_B2, department: "Test Team B" },
    ]);
    const scope = await PeopleScopeEngine.resolveScope(MGR2_EMP_ID);
    expect(scope.employeeIds).toEqual([EMP_B1, EMP_B2]);
    expect(scope.departments).toEqual(["Test Team B"]);
    expect(scope.employeeIds).not.toContain(EMP_A1);
  });

  it("Manager 1 cannot assertInScope over Manager 2's employee (URL/API IDOR)", async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      PeopleScopeEngine.assertInScope(MGR1_EMP_ID, EMP_B1)
    ).rejects.toBeInstanceOf(PermissionError);
    await expect(PeopleScopeEngine.isInScope(MGR1_EMP_ID, EMP_B1)).resolves.toBe(
      false
    );
  });

  it("Manager 2 cannot assertInScope over Manager 1's employee", async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      PeopleScopeEngine.assertInScope(MGR2_EMP_ID, EMP_A1)
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("Manager 1 can assertInScope over own report", async () => {
    findFirst.mockResolvedValue({ id: EMP_A1 });
    await expect(
      PeopleScopeEngine.assertInScope(MGR1_EMP_ID, EMP_A1)
    ).resolves.toBeUndefined();
  });
});

describe("test manager accounts — cross-manager leave approval denial", () => {
  it("Manager 1 can approve leave where they are the designated approver", () => {
    const leave = leaveForReport({ employeeId: EMP_A1, approverId: MGR1_EMP_ID });
    expect(canUserApproveStep(managerActor(MGR1_EMP_ID), leave)).toBe(true);
  });

  it("Manager 1 cannot approve Manager 2's designated leave step", () => {
    const leave = leaveForReport({ employeeId: EMP_B1, approverId: MGR2_EMP_ID });
    expect(canUserApproveStep(managerActor(MGR1_EMP_ID), leave)).toBe(false);
  });

  it("Manager 2 cannot approve Manager 1's designated leave step", () => {
    const leave = leaveForReport({ employeeId: EMP_A1, approverId: MGR1_EMP_ID });
    expect(canUserApproveStep(managerActor(MGR2_EMP_ID), leave)).toBe(false);
  });

  it("neither manager can approve hr_admin steps", () => {
    const leave: LeaveStepAuthLeave = {
      employeeId: EMP_A1,
      workflowStatus: LeaveWorkflowStatus.pending_approval,
      currentStepId: 9,
      approvalSteps: [
        {
          id: 9,
          stepOrder: 2,
          status: ApprovalStepStatus.pending,
          approverRole: ApproverRole.hr_admin,
          approverId: null,
        },
      ],
    };
    expect(canUserApproveStep(managerActor(MGR1_EMP_ID), leave)).toBe(false);
    expect(canUserApproveStep(managerActor(MGR2_EMP_ID), leave)).toBe(false);
  });
});

describe("test manager accounts — concurrent operations (independent scopes)", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("both managers can resolve their scopes without sharing employee IDs", async () => {
    findMany
      .mockResolvedValueOnce([
        { id: EMP_A1, department: "Test Team A" },
        { id: EMP_A2, department: "Test Team A" },
      ])
      .mockResolvedValueOnce([
        { id: EMP_B1, department: "Test Team B" },
        { id: EMP_B2, department: "Test Team B" },
      ]);

    const [scope1, scope2] = await Promise.all([
      PeopleScopeEngine.resolveScope(MGR1_EMP_ID),
      PeopleScopeEngine.resolveScope(MGR2_EMP_ID),
    ]);

    const overlap = scope1.employeeIds.filter((id) => scope2.employeeIds.includes(id));
    expect(overlap).toEqual([]);
    expect(scope1.employeeIds).toHaveLength(2);
    expect(scope2.employeeIds).toHaveLength(2);
  });

  it("both managers can approve their own leave steps concurrently (logic)", () => {
    const leaveA = leaveForReport({ employeeId: EMP_A1, approverId: MGR1_EMP_ID });
    const leaveB = leaveForReport({ employeeId: EMP_B1, approverId: MGR2_EMP_ID });
    expect(canUserApproveStep(managerActor(MGR1_EMP_ID), leaveA)).toBe(true);
    expect(canUserApproveStep(managerActor(MGR2_EMP_ID), leaveB)).toBe(true);
    expect(canUserApproveStep(managerActor(MGR1_EMP_ID), leaveB)).toBe(false);
    expect(canUserApproveStep(managerActor(MGR2_EMP_ID), leaveA)).toBe(false);
  });
});
