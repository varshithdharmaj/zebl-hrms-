import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/manager/dashboard-service", () => ({
  getMyTeamOverview: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { getMyTeamOverview } from "@/lib/manager/dashboard-service";
import { getMyTeamOverviewAction } from "@/actions/my-team";
import { MY_TEAM_QUICK_ACTIONS } from "@/lib/manager/dashboard-types";

describe("getMyTeamOverviewAction", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    vi.mocked(getMyTeamOverview).mockReset();
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(getMyTeamOverviewAction()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
  });

  it("rejects non-line-managers", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: "1",
      email: "e@x.com",
      role: "employee",
      employeeId: 5,
      employeeName: "Pat",
      sessionVersion: 1,
      authProvider: "local",
    });
    vi.mocked(getMyTeamOverview).mockResolvedValue(null);
    await expect(getMyTeamOverviewAction()).resolves.toEqual({
      ok: false,
      error: "My Team overview is only available to line managers.",
    });
  });

  it("returns overview DTO for line managers", async () => {
    const session = {
      id: "1",
      email: "e@x.com",
      role: "employee" as const,
      employeeId: 5,
      employeeName: "Pat",
      sessionVersion: 1,
      authProvider: "local" as const,
    };
    vi.mocked(getSession).mockResolvedValue(session);
    const data = {
      directReportCount: 2,
      attention: { pendingCount: 1, overdueCount: 0, slaLabel: "12h left", error: false },
      absentToday: { items: [], error: false },
      presence: { present: 1, onLeave: 0, unknown: 1, error: false },
      quickActions: MY_TEAM_QUICK_ACTIONS,
    };
    vi.mocked(getMyTeamOverview).mockResolvedValue(data);
    await expect(getMyTeamOverviewAction()).resolves.toEqual({ ok: true, data });
    expect(getMyTeamOverview).toHaveBeenCalledWith(session);
  });
});
