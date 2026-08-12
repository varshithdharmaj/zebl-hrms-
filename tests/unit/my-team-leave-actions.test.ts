import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionError } from "@/lib/permissions";

vi.mock("@/lib/auth", () => ({
  getApplicationSession: vi.fn(),
}));

vi.mock("@/lib/manager/team-leave-query", () => ({
  getMyTeamLeaveOverview: vi.fn(),
}));

vi.mock("@/lib/manager/team-calendar-query", () => ({
  getMyTeamCalendar: vi.fn(),
}));

import { getApplicationSession } from "@/lib/auth";
import { getMyTeamLeaveOverview } from "@/lib/manager/team-leave-query";
import { getMyTeamCalendar } from "@/lib/manager/team-calendar-query";
import {
  listMyTeamLeaveOverviewAction,
  listMyTeamCalendarAction,
} from "@/actions/my-team";

const managerSession = {
  id: "1",
  email: "e@x.com",
  role: "employee" as const,
  employeeId: 5,
  employeeName: "Pat",
  sessionVersion: 1,
  authProvider: "local" as const,
};

describe("listMyTeamLeaveOverviewAction", () => {
  beforeEach(() => {
    vi.mocked(getApplicationSession).mockReset();
    vi.mocked(getMyTeamLeaveOverview).mockReset();
  });

  it("rejects unauthorized sessions", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue(null);
    await expect(listMyTeamLeaveOverviewAction()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
  });

  it("maps permission errors (authorization)", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue(managerSession);
    vi.mocked(getMyTeamLeaveOverview).mockRejectedValue(
      new PermissionError("My Team leave is only available to line managers.")
    );
    await expect(listMyTeamLeaveOverviewAction()).resolves.toEqual({
      ok: false,
      error: "My Team leave is only available to line managers.",
    });
  });

  it("returns leave overview for managers", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue(managerSession);
    const data = {
      directReportCount: 0,
      balances: [],
      currentlyOnLeave: [],
      pending: [],
      approved: [],
      rejected: [],
      recent: [],
    };
    vi.mocked(getMyTeamLeaveOverview).mockResolvedValue(data);
    await expect(listMyTeamLeaveOverviewAction()).resolves.toEqual({ ok: true, data });
    expect(getMyTeamLeaveOverview).toHaveBeenCalledWith(5);
  });
});

describe("listMyTeamCalendarAction", () => {
  beforeEach(() => {
    vi.mocked(getApplicationSession).mockReset();
    vi.mocked(getMyTeamCalendar).mockReset();
  });

  it("rejects unauthorized sessions", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue(null);
    await expect(listMyTeamCalendarAction()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
  });

  it("maps permission errors", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue(managerSession);
    vi.mocked(getMyTeamCalendar).mockRejectedValue(
      new PermissionError("My Team calendar is only available to line managers.")
    );
    await expect(listMyTeamCalendarAction({ view: "week" })).resolves.toEqual({
      ok: false,
      error: "My Team calendar is only available to line managers.",
    });
  });

  it("returns calendar data", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue(managerSession);
    const data = {
      view: "month" as const,
      rangeStart: new Date("2026-03-01"),
      rangeEnd: new Date("2026-03-31"),
      rangeLabel: "March 2026",
      events: [],
      holidays: [],
      directReportCount: 2,
    };
    vi.mocked(getMyTeamCalendar).mockResolvedValue(data);
    await expect(
      listMyTeamCalendarAction({ view: "month", date: "2026-03-01" })
    ).resolves.toEqual({ ok: true, data });
    expect(getMyTeamCalendar).toHaveBeenCalledWith(5, {
      view: "month",
      date: "2026-03-01",
    });
  });
});
