import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/session";

const isLineManager = vi.fn();
const resolveScope = vi.fn();
const getPendingApprovalsForActor = vi.fn();
const getEscalationSlaHours = vi.fn();
const leaveFindMany = vi.fn();
const attendanceFindMany = vi.fn();

vi.mock("@/lib/people-scope/engine", () => ({
  PeopleScopeEngine: {
    isLineManager: (...args: unknown[]) => isLineManager(...args),
    resolveScope: (...args: unknown[]) => resolveScope(...args),
  },
}));

vi.mock("@/lib/workflow/pending-approvals", () => ({
  getPendingApprovalsForActor: (...args: unknown[]) => getPendingApprovalsForActor(...args),
}));

vi.mock("@/lib/workflow/workflow-sla", () => ({
  getEscalationSlaHours: (...args: unknown[]) => getEscalationSlaHours(...args),
  computeSlaState: (submittedAt: Date | null, hours: number) => {
    if (!submittedAt) {
      return { label: "—", hoursRemaining: null, overdue: false, percentElapsed: 0 };
    }
    const elapsedMs = Date.now() - submittedAt.getTime();
    const totalMs = hours * 60 * 60 * 1000;
    const overdue = elapsedMs > totalMs;
    const hoursRemaining = Math.max(0, Math.ceil((totalMs - elapsedMs) / (1000 * 60 * 60)));
    return {
      label: overdue ? "Overdue" : `${hoursRemaining}h left`,
      hoursRemaining: overdue ? 0 : hoursRemaining,
      overdue,
      percentElapsed: 50,
    };
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leaveRequest: {
      findMany: (...args: unknown[]) => leaveFindMany(...args),
    },
    attendanceRecord: {
      findMany: (...args: unknown[]) => attendanceFindMany(...args),
    },
  },
}));

import { getMyTeamOverview } from "@/lib/manager/dashboard-service";
import { MY_TEAM_QUICK_ACTIONS } from "@/lib/manager/dashboard-types";

const managerSession: SessionUser = {
  id: "u1",
  email: "mgr@zebl.com",
  role: "employee",
  employeeId: 100,
  employeeName: "Manager",
  sessionVersion: 1,
  authProvider: "local",
};

describe("getMyTeamOverview", () => {
  beforeEach(() => {
    isLineManager.mockReset();
    resolveScope.mockReset();
    getPendingApprovalsForActor.mockReset();
    getEscalationSlaHours.mockReset();
    leaveFindMany.mockReset();
    attendanceFindMany.mockReset();

    isLineManager.mockResolvedValue(true);
    resolveScope.mockResolvedValue({
      mode: "DIRECT",
      employeeIds: [1, 2],
      departments: ["Eng"],
    });
    getPendingApprovalsForActor.mockResolvedValue([]);
    getEscalationSlaHours.mockResolvedValue(24);
    leaveFindMany.mockResolvedValue([]);
    attendanceFindMany.mockResolvedValue([]);
  });

  it("returns null when session has no employeeId", async () => {
    await expect(
      getMyTeamOverview({ ...managerSession, employeeId: null })
    ).resolves.toBeNull();
    expect(isLineManager).not.toHaveBeenCalled();
  });

  it("returns null when actor is not a line manager", async () => {
    isLineManager.mockResolvedValue(false);
    await expect(getMyTeamOverview(managerSession)).resolves.toBeNull();
    expect(resolveScope).not.toHaveBeenCalled();
  });

  it("sets scope banner count from PeopleScopeEngine.resolveScope", async () => {
    resolveScope.mockResolvedValue({
      mode: "DIRECT",
      employeeIds: [10, 11, 12],
      departments: [],
    });
    const dto = await getMyTeamOverview(managerSession);
    expect(dto?.directReportCount).toBe(3);
    expect(isLineManager).toHaveBeenCalledWith(100);
    expect(resolveScope).toHaveBeenCalledWith(100);
  });

  it("handles empty team", async () => {
    resolveScope.mockResolvedValue({ mode: "DIRECT", employeeIds: [], departments: [] });
    const dto = await getMyTeamOverview(managerSession);
    expect(dto?.directReportCount).toBe(0);
    expect(dto?.absentToday.items).toEqual([]);
    expect(dto?.presence).toMatchObject({ present: 0, onLeave: 0, unknown: 0, error: false });
    expect(leaveFindMany).not.toHaveBeenCalled();
    expect(attendanceFindMany).not.toHaveBeenCalled();
  });

  it("loads absent today and presence using scoped employee IDs only", async () => {
    leaveFindMany.mockResolvedValue([
      {
        leaveType: "EL",
        employee: { id: 1, name: "Ada" },
      },
    ]);
    attendanceFindMany.mockResolvedValue([{ employeeId: 2 }]);

    const dto = await getMyTeamOverview(managerSession);
    expect(dto?.absentToday.items).toEqual([
      { employeeId: 1, name: "Ada", leaveType: "EL" },
    ]);
    expect(dto?.presence).toMatchObject({
      present: 1,
      onLeave: 1,
      unknown: 0,
      error: false,
    });

    expect(leaveFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: { in: [1, 2] },
        }),
      })
    );
    expect(attendanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: { in: [1, 2] },
        }),
      })
    );

    const leaveWhere = leaveFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    const attendanceWhere = attendanceFindMany.mock.calls[0]?.[0]?.where as Record<
      string,
      unknown
    >;
    expect(leaveWhere).not.toHaveProperty("managerId");
    expect(JSON.stringify(leaveWhere)).not.toContain("managerId");
    expect(JSON.stringify(attendanceWhere)).not.toContain("managerId");
  });

  it("soft-fails widgets independently", async () => {
    getPendingApprovalsForActor.mockRejectedValue(new Error("approvals down"));
    leaveFindMany.mockRejectedValue(new Error("leave down"));
    attendanceFindMany.mockRejectedValue(new Error("attendance down"));

    const dto = await getMyTeamOverview(managerSession);
    expect(dto).not.toBeNull();
    expect(dto?.directReportCount).toBe(2);
    expect(dto?.attention.error).toBe(true);
    expect(dto?.attention.pendingCount).toBe(0);
    expect(dto?.absentToday.error).toBe(true);
    expect(dto?.presence.error).toBe(true);
  });

  it("includes pending count and SLA on attention strip", async () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    getPendingApprovalsForActor.mockResolvedValue([
      { id: 1, submittedAt: old },
      { id: 2, submittedAt: new Date() },
    ]);
    getEscalationSlaHours.mockResolvedValue(24);

    const dto = await getMyTeamOverview(managerSession);
    expect(dto?.attention.pendingCount).toBe(2);
    expect(dto?.attention.overdueCount).toBe(1);
    expect(dto?.attention.slaLabel).toBe("Overdue");
    expect(dto?.attention.error).toBe(false);
  });

  it("exposes fixed quick actions", async () => {
    const dto = await getMyTeamOverview(managerSession);
    expect(dto?.quickActions).toEqual(MY_TEAM_QUICK_ACTIONS);
  });
});
