import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionError } from "@/lib/permissions";

vi.mock("@/lib/auth", () => ({
  getApplicationSession: vi.fn(),
}));

vi.mock("@/lib/manager/team-attendance-query", () => ({
  listMyTeamAttendance: vi.fn(),
}));

import { getApplicationSession } from "@/lib/auth";
import { listMyTeamAttendance } from "@/lib/manager/team-attendance-query";
import { listMyTeamAttendanceAction } from "@/actions/my-team";

describe("listMyTeamAttendanceAction", () => {
  beforeEach(() => {
    vi.mocked(getApplicationSession).mockReset();
    vi.mocked(listMyTeamAttendance).mockReset();
  });

  it("rejects unauthorized sessions", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue(null);
    await expect(listMyTeamAttendanceAction()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
  });

  it("maps permission errors", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue({
      id: "1",
      email: "e@x.com",
      role: "employee",
      employeeId: 5,
      employeeName: "Pat",
      sessionVersion: 1,
      authProvider: "local",
    });
    vi.mocked(listMyTeamAttendance).mockRejectedValue(
      new PermissionError("My Team attendance is only available to line managers.")
    );
    await expect(listMyTeamAttendanceAction()).resolves.toEqual({
      ok: false,
      error: "My Team attendance is only available to line managers.",
    });
  });

  it("returns attendance data for managers", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue({
      id: "1",
      email: "e@x.com",
      role: "employee",
      employeeId: 5,
      employeeName: "Pat",
      sessionVersion: 1,
      authProvider: "local",
    });
    const data = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
      totalPages: 0,
    };
    vi.mocked(listMyTeamAttendance).mockResolvedValue(data);
    await expect(listMyTeamAttendanceAction({ search: "x" })).resolves.toEqual({
      ok: true,
      data,
    });
    expect(listMyTeamAttendance).toHaveBeenCalledWith(5, { search: "x" });
  });
});
