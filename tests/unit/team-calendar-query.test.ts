import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionError } from "@/lib/permissions";

const isLineManager = vi.fn();
const resolveScope = vi.fn();
const getLeaveCalendarEvents = vi.fn();
const getHolidaysForRange = vi.fn();

vi.mock("@/lib/people-scope/engine", () => ({
  PeopleScopeEngine: {
    isLineManager: (...args: unknown[]) => isLineManager(...args),
    resolveScope: (...args: unknown[]) => resolveScope(...args),
  },
}));

vi.mock("@/lib/leave/leave-calendar", () => ({
  getLeaveCalendarEvents: (...args: unknown[]) => getLeaveCalendarEvents(...args),
  getHolidaysForRange: (...args: unknown[]) => getHolidaysForRange(...args),
}));

import { getMyTeamCalendar } from "@/lib/manager/team-calendar-query";

describe("getMyTeamCalendar", () => {
  beforeEach(() => {
    isLineManager.mockReset();
    resolveScope.mockReset();
    getLeaveCalendarEvents.mockReset();
    getHolidaysForRange.mockReset();

    isLineManager.mockResolvedValue(true);
    resolveScope.mockResolvedValue({
      mode: "DIRECT",
      employeeIds: [7, 8],
      departments: ["Ops"],
    });
    getLeaveCalendarEvents.mockResolvedValue([
      {
        id: 1,
        employeeId: 7,
        employeeName: "Bob",
        department: "Ops",
        leaveType: "casual",
        startDate: new Date("2026-03-10"),
        endDate: new Date("2026-03-11"),
        workflowStatus: "approved",
      },
    ]);
    getHolidaysForRange.mockResolvedValue([]);
  });

  it("denies non-line-managers", async () => {
    isLineManager.mockResolvedValue(false);
    await expect(getMyTeamCalendar(50)).rejects.toBeInstanceOf(PermissionError);
    expect(getLeaveCalendarEvents).not.toHaveBeenCalled();
  });

  it("passes scoped employeeIds into getLeaveCalendarEvents (no teamManagerId)", async () => {
    await getMyTeamCalendar(50, { view: "month", date: "2026-03-15" });
    expect(resolveScope).toHaveBeenCalledWith(50);
    expect(getLeaveCalendarEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeIds: [7, 8],
      })
    );
    const arg = getLeaveCalendarEvents.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.teamManagerId).toBeUndefined();
  });

  it("skips leave query when scope is empty", async () => {
    resolveScope.mockResolvedValue({ mode: "DIRECT", employeeIds: [], departments: [] });
    const result = await getMyTeamCalendar(50, { view: "month", date: "2026-03-01" });
    expect(result.events).toEqual([]);
    expect(result.directReportCount).toBe(0);
    expect(getLeaveCalendarEvents).not.toHaveBeenCalled();
    expect(getHolidaysForRange).toHaveBeenCalled();
  });

  it("supports week view range", async () => {
    const result = await getMyTeamCalendar(50, { view: "week", date: "2026-03-11" });
    expect(result.view).toBe("week");
    const arg = getLeaveCalendarEvents.mock.calls[0][0] as {
      start: Date;
      end: Date;
    };
    const days =
      Math.round((arg.end.getTime() - arg.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    expect(days).toBe(7);
  });

  it("supports explicit date range", async () => {
    const result = await getMyTeamCalendar(50, {
      view: "range",
      from: "2026-03-01",
      to: "2026-03-14",
    });
    expect(result.view).toBe("range");
    expect(getLeaveCalendarEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeIds: [7, 8],
        start: expect.any(Date),
        end: expect.any(Date),
      })
    );
  });
});
