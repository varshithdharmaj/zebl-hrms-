import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApproverRole } from "@/generated/prisma/enums";
import { buildApprovalChain } from "@/lib/workflow/approval-routing";

const getManager = vi.fn();

vi.mock("@/lib/org", () => ({
  getManager: (...args: unknown[]) => getManager(...args),
}));

function managerSummary(id: number) {
  return {
    id,
    employeeCode: `E${id}`,
    name: `Person ${id}`,
    department: "Engineering",
    designation: "Lead",
  };
}

describe("buildApprovalChain", () => {
  beforeEach(() => {
    getManager.mockReset();
  });

  it("Employee + Team Lead + Department Head → three steps", async () => {
    // employee 1 → TL 10 → Dept Head 20
    getManager.mockImplementation(async (employeeId: number) => {
      if (employeeId === 1) return managerSummary(10);
      if (employeeId === 10) return managerSummary(20);
      return null;
    });

    const chain = await buildApprovalChain({ employeeId: 1, leaveDays: 1 });

    expect(chain).toEqual([
      { stepOrder: 1, approverId: 10, approverRole: ApproverRole.manager },
      { stepOrder: 2, approverId: 20, approverRole: ApproverRole.skip_level_manager },
      { stepOrder: 3, approverId: null, approverRole: ApproverRole.hr_admin },
    ]);
  });

  it("Employee + Team Lead only (no Department Head) → Team Lead → HR", async () => {
    getManager.mockImplementation(async (employeeId: number) => {
      if (employeeId === 1) return managerSummary(10);
      if (employeeId === 10) return null;
      return null;
    });

    const chain = await buildApprovalChain({ employeeId: 1, leaveDays: 10 });

    expect(chain).toEqual([
      { stepOrder: 1, approverId: 10, approverRole: ApproverRole.manager },
      { stepOrder: 2, approverId: null, approverRole: ApproverRole.hr_admin },
    ]);
  });

  it("Employee without Team Lead → HR only", async () => {
    getManager.mockResolvedValue(null);

    const chain = await buildApprovalChain({ employeeId: 1 });

    expect(chain).toEqual([
      { stepOrder: 1, approverId: null, approverRole: ApproverRole.hr_admin },
    ]);
  });

  it("short leave still includes Department Head when hierarchy exists", async () => {
    getManager.mockImplementation(async (employeeId: number) => {
      if (employeeId === 1) return managerSummary(10);
      if (employeeId === 10) return managerSummary(20);
      return null;
    });

    const chain = await buildApprovalChain({ employeeId: 1, leaveDays: 1 });

    expect(chain).toHaveLength(3);
    expect(chain[1]).toMatchObject({
      approverId: 20,
      approverRole: ApproverRole.skip_level_manager,
    });
  });

  it("omits Department Head when same as Team Lead", async () => {
    getManager.mockImplementation(async (employeeId: number) => {
      if (employeeId === 1) return managerSummary(10);
      if (employeeId === 10) return managerSummary(10);
      return null;
    });

    const chain = await buildApprovalChain({ employeeId: 1 });

    expect(chain).toEqual([
      { stepOrder: 1, approverId: 10, approverRole: ApproverRole.manager },
      { stepOrder: 2, approverId: null, approverRole: ApproverRole.hr_admin },
    ]);
  });

  it("inactive / missing Team Lead falls through to HR only", async () => {
    // getManager returns null for inactive managers (org.ts filter).
    getManager.mockResolvedValue(null);

    const chain = await buildApprovalChain({ employeeId: 1 });

    expect(chain).toEqual([
      { stepOrder: 1, approverId: null, approverRole: ApproverRole.hr_admin },
    ]);
  });

  it("inactive / missing Department Head falls through to Team Lead → HR", async () => {
    getManager.mockImplementation(async (employeeId: number) => {
      if (employeeId === 1) return managerSummary(10);
      // Team Lead's manager inactive / deleted → unresolved
      if (employeeId === 10) return null;
      return null;
    });

    const chain = await buildApprovalChain({ employeeId: 1 });

    expect(chain).toEqual([
      { stepOrder: 1, approverId: 10, approverRole: ApproverRole.manager },
      { stepOrder: 2, approverId: null, approverRole: ApproverRole.hr_admin },
    ]);
  });
});
