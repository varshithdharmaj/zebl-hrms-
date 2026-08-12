import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionError } from "@/lib/permissions";

const isLineManager = vi.fn();
const resolveScope = vi.fn();
const assertInScope = vi.fn();
const getDirectReportSafe = vi.fn();
const toManagerSafeEmployee = vi.fn((row: Record<string, unknown>) => ({
  id: row.id,
  employeeCode: row.employeeCode,
  name: row.name,
  department: row.department,
  designation: row.designation,
  employeeStatus: row.employeeStatus,
  isActive: row.isActive,
  shift: row.shift,
  joiningDate: row.joiningDate,
  workLocation: row.workLocation ?? null,
  employmentType: row.employmentType ?? null,
}));

const employeeCount = vi.fn();
const employeeFindMany = vi.fn();
const leaveFindMany = vi.fn();
const getLeaveBalanceSummaries = vi.fn();
const getEmployeeAttendanceSummary = vi.fn();

vi.mock("@/lib/people-scope/engine", () => ({
  PeopleScopeEngine: {
    isLineManager: (...args: unknown[]) => isLineManager(...args),
    resolveScope: (...args: unknown[]) => resolveScope(...args),
    assertInScope: (...args: unknown[]) => assertInScope(...args),
    getDirectReportSafe: (...args: unknown[]) => getDirectReportSafe(...args),
    toManagerSafeEmployee: (...args: unknown[]) => toManagerSafeEmployee(...args),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      count: (...args: unknown[]) => employeeCount(...args),
      findMany: (...args: unknown[]) => employeeFindMany(...args),
    },
    leaveRequest: {
      findMany: (...args: unknown[]) => leaveFindMany(...args),
    },
  },
}));

vi.mock("@/lib/leave", () => ({
  getLeaveBalanceSummaries: (...args: unknown[]) => getLeaveBalanceSummaries(...args),
}));

vi.mock("@/lib/data/attendance", () => ({
  getEmployeeAttendanceSummary: (...args: unknown[]) => getEmployeeAttendanceSummary(...args),
}));

import { getMyTeamPerson, listMyTeamPeople } from "@/lib/manager/team-people-query";

const MANAGER_ID = 100;

function safePerson(id: number) {
  return {
    id,
    employeeCode: `E${id}`,
    name: `Person ${id}`,
    department: "Engineering",
    designation: "Engineer",
    employeeStatus: "Active",
    isActive: true,
    shift: "General",
    joiningDate: new Date("2024-01-01"),
    workLocation: "HQ",
    employmentType: "Full-time",
  };
}

describe("listMyTeamPeople", () => {
  beforeEach(() => {
    isLineManager.mockReset();
    resolveScope.mockReset();
    employeeCount.mockReset();
    employeeFindMany.mockReset();

    isLineManager.mockResolvedValue(true);
    resolveScope.mockResolvedValue({
      mode: "DIRECT",
      employeeIds: [1, 2, 3],
      departments: ["Engineering"],
    });
    employeeCount.mockResolvedValue(3);
    employeeFindMany.mockResolvedValue([safePerson(1), safePerson(2)]);
  });

  it("returns empty list when scope has no reports", async () => {
    resolveScope.mockResolvedValue({ mode: "DIRECT", employeeIds: [], departments: [] });
    const result = await listMyTeamPeople(MANAGER_ID);
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
    expect(employeeFindMany).not.toHaveBeenCalled();
  });

  it("scopes queries to PeopleScopeEngine employee IDs only", async () => {
    await listMyTeamPeople(MANAGER_ID, { search: "Ada" });
    expect(resolveScope).toHaveBeenCalledWith(MANAGER_ID);
    const where = employeeFindMany.mock.calls[0]?.[0]?.where as {
      id: { in: number[] };
      OR?: unknown;
    };
    expect(where.id).toEqual({ in: [1, 2, 3] });
    expect(where.OR).toBeDefined();
    expect(JSON.stringify(where)).not.toContain("managerId");
  });

  it("paginates with skip/take and sorts by name", async () => {
    await listMyTeamPeople(MANAGER_ID, { page: 2, pageSize: 10 });
    expect(employeeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: "asc" },
        skip: 10,
        take: 10,
      })
    );
  });

  it("maps rows through manager-safe DTO", async () => {
    const result = await listMyTeamPeople(MANAGER_ID);
    expect(toManagerSafeEmployee).toHaveBeenCalled();
    expect(result.items[0]).not.toHaveProperty("email");
    expect(result.items[0]).not.toHaveProperty("phone");
  });

  it("denies non-line-managers", async () => {
    isLineManager.mockResolvedValue(false);
    await expect(listMyTeamPeople(MANAGER_ID)).rejects.toBeInstanceOf(PermissionError);
  });
});

describe("getMyTeamPerson", () => {
  beforeEach(() => {
    assertInScope.mockReset();
    getDirectReportSafe.mockReset();
    leaveFindMany.mockReset();
    getLeaveBalanceSummaries.mockReset();
    getEmployeeAttendanceSummary.mockReset();

    assertInScope.mockResolvedValue(undefined);
    getDirectReportSafe.mockResolvedValue(safePerson(1));
    getLeaveBalanceSummaries.mockResolvedValue([]);
    leaveFindMany.mockResolvedValue([]);
    getEmployeeAttendanceSummary.mockResolvedValue({
      presentDays: 10,
      shortHoursCount: 1,
      attendancePercent: 90,
      lastAttendanceDate: new Date("2026-03-01"),
      rangeLabel: "Last 30 days",
      records: [],
    });
  });

  it("asserts scope before loading subject data", async () => {
    const callOrder: string[] = [];
    assertInScope.mockImplementation(async () => {
      callOrder.push("assert");
    });
    getDirectReportSafe.mockImplementation(async () => {
      callOrder.push("load");
      return safePerson(1);
    });

    await getMyTeamPerson(MANAGER_ID, 1);
    expect(assertInScope).toHaveBeenCalledWith(MANAGER_ID, 1);
    expect(callOrder[0]).toBe("assert");
  });

  it("blocks IDOR when assertInScope fails", async () => {
    assertInScope.mockRejectedValue(new PermissionError("Subject is outside manager scope."));
    await expect(getMyTeamPerson(MANAGER_ID, 999)).rejects.toBeInstanceOf(PermissionError);
    expect(getDirectReportSafe).not.toHaveBeenCalled();
    expect(leaveFindMany).not.toHaveBeenCalled();
  });

  it("returns manager-safe person without protected fields", async () => {
    const detail = await getMyTeamPerson(MANAGER_ID, 1);
    expect(detail.person.id).toBe(1);
    expect(detail.person).not.toHaveProperty("email");
    expect(detail.person).not.toHaveProperty("phone");
    expect(detail.person).not.toHaveProperty("address");
    expect(detail.attendance.presentDays).toBe(10);
  });

  it("loads leave balances with processAccruals: true (authoritative current balance)", async () => {
    await getMyTeamPerson(MANAGER_ID, 1);
    expect(getLeaveBalanceSummaries).toHaveBeenCalledWith(1, { processAccruals: true });
  });
});
