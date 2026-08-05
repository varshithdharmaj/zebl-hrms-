import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { PermissionError } from "@/lib/permissions";

const isLineManager = vi.fn();
const resolveScope = vi.fn();
const toManagerSafeEmployee = vi.fn((e: { id: number; name: string; employeeCode: string }) => ({
  id: e.id,
  employeeCode: e.employeeCode,
  name: e.name,
  department: null,
  designation: null,
  employeeStatus: "Active",
  isActive: true,
  shift: null,
  joiningDate: new Date("2024-01-01"),
  workLocation: null,
  employmentType: null,
}));

const findManyEmployee = vi.fn();
const findManyLeave = vi.fn();
const getLeaveBalanceSummariesForEmployees = vi.fn();

vi.mock("@/lib/people-scope/engine", () => ({
  PeopleScopeEngine: {
    isLineManager: (...args: unknown[]) => isLineManager(...args),
    resolveScope: (...args: unknown[]) => resolveScope(...args),
    toManagerSafeEmployee: (...args: unknown[]) => toManagerSafeEmployee(...args),
  },
}));

vi.mock("@/lib/leave", () => ({
  getLeaveBalanceSummariesForEmployees: (...args: unknown[]) =>
    getLeaveBalanceSummariesForEmployees(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findMany: (...args: unknown[]) => findManyEmployee(...args),
    },
    leaveRequest: {
      findMany: (...args: unknown[]) => findManyLeave(...args),
    },
  },
}));

import { getMyTeamLeaveOverview } from "@/lib/manager/team-leave-query";

describe("getMyTeamLeaveOverview", () => {
  beforeEach(() => {
    isLineManager.mockReset();
    resolveScope.mockReset();
    toManagerSafeEmployee.mockClear();
    findManyEmployee.mockReset();
    findManyLeave.mockReset();
    getLeaveBalanceSummariesForEmployees.mockReset();

    isLineManager.mockResolvedValue(true);
    resolveScope.mockResolvedValue({
      mode: "DIRECT",
      employeeIds: [1, 2],
      departments: ["Eng"],
    });
    findManyEmployee.mockResolvedValue([
      {
        id: 1,
        employeeCode: "E1",
        name: "Ada",
        department: "Eng",
        designation: "IC",
        employeeStatus: "Active",
        isActive: true,
        shift: "General",
        joiningDate: new Date("2024-01-01"),
        workLocation: null,
        employmentType: null,
      },
    ]);
    getLeaveBalanceSummariesForEmployees.mockResolvedValue(
      new Map([
        [
          1,
          [
            {
              leaveType: "casual",
              remaining: 5,
              used: 1,
              total: 6,
              eligible: true,
            },
          ],
        ],
      ])
    );
    findManyLeave.mockImplementation(async (args: { where?: { workflowStatus?: string } }) => {
      if (args?.where?.workflowStatus === LeaveWorkflowStatus.approved) {
        return [
          {
            id: 99,
            employeeId: 1,
            leaveType: "casual",
            startDate: new Date("2026-03-01"),
            endDate: new Date("2026-03-02"),
            days: 2,
            workflowStatus: LeaveWorkflowStatus.approved,
            employee: { name: "Ada", employeeCode: "E1" },
          },
        ];
      }
      return [
        {
          id: 10,
          employeeId: 1,
          leaveType: "casual",
          startDate: new Date("2026-03-10"),
          endDate: new Date("2026-03-11"),
          days: 2,
          workflowStatus: LeaveWorkflowStatus.pending_approval,
          employee: { name: "Ada", employeeCode: "E1" },
        },
        {
          id: 11,
          employeeId: 1,
          leaveType: "sick",
          startDate: new Date("2026-02-01"),
          endDate: new Date("2026-02-01"),
          days: 1,
          workflowStatus: LeaveWorkflowStatus.approved,
          employee: { name: "Ada", employeeCode: "E1" },
        },
        {
          id: 12,
          employeeId: 1,
          leaveType: "casual",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-01-01"),
          days: 1,
          workflowStatus: LeaveWorkflowStatus.rejected,
          employee: { name: "Ada", employeeCode: "E1" },
        },
      ];
    });
  });

  it("denies non-line-managers", async () => {
    isLineManager.mockResolvedValue(false);
    await expect(getMyTeamLeaveOverview(100)).rejects.toBeInstanceOf(PermissionError);
    expect(resolveScope).not.toHaveBeenCalled();
  });

  it("uses PeopleScopeEngine.resolveScope (no raw managerId)", async () => {
    await getMyTeamLeaveOverview(100);
    expect(resolveScope).toHaveBeenCalledWith(100);
    expect(findManyEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [1, 2] } },
      })
    );
    const leaveCalls = findManyLeave.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(leaveCalls.every((c) => !c.includes("managerId"))).toBe(true);
  });

  it("returns empty state when scope is empty", async () => {
    resolveScope.mockResolvedValue({ mode: "DIRECT", employeeIds: [], departments: [] });
    const result = await getMyTeamLeaveOverview(100);
    expect(result.directReportCount).toBe(0);
    expect(result.balances).toEqual([]);
    expect(result.recent).toEqual([]);
    expect(findManyEmployee).not.toHaveBeenCalled();
    expect(getLeaveBalanceSummariesForEmployees).not.toHaveBeenCalled();
  });

  it("maps leave history into status buckets", async () => {
    const result = await getMyTeamLeaveOverview(100);
    expect(result.pending).toHaveLength(1);
    expect(result.approved).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.recent).toHaveLength(3);
    expect(result.currentlyOnLeave[0]?.id).toBe(99);
    expect(result.balances[0]?.balances[0]?.remaining).toBe(5);
    expect(getLeaveBalanceSummariesForEmployees).toHaveBeenCalled();
  });
});
