import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionError } from "@/lib/permissions";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/manager/team-people-query", () => ({
  listMyTeamPeople: vi.fn(),
  getMyTeamPerson: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { getMyTeamPerson, listMyTeamPeople } from "@/lib/manager/team-people-query";
import { getMyTeamPersonAction, listMyTeamPeopleAction } from "@/actions/my-team";

describe("My Team people actions", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    vi.mocked(listMyTeamPeople).mockReset();
    vi.mocked(getMyTeamPerson).mockReset();
  });

  it("listMyTeamPeopleAction rejects unauthenticated users", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(listMyTeamPeopleAction()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
  });

  it("listMyTeamPeopleAction returns data", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: "1",
      email: "e@x.com",
      role: "employee",
      employeeId: 100,
      employeeName: "Mgr",
      sessionVersion: 1,
      authProvider: "local",
    });
    vi.mocked(listMyTeamPeople).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });
    await expect(listMyTeamPeopleAction({ search: "a" })).resolves.toEqual({
      ok: true,
      data: { items: [], total: 0, page: 1, pageSize: 25 },
    });
    expect(listMyTeamPeople).toHaveBeenCalledWith(100, { search: "a" });
  });

  it("getMyTeamPersonAction masks IDOR as not found", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: "1",
      email: "e@x.com",
      role: "employee",
      employeeId: 100,
      employeeName: "Mgr",
      sessionVersion: 1,
      authProvider: "local",
    });
    vi.mocked(getMyTeamPerson).mockRejectedValue(
      new PermissionError("Subject is outside manager scope.")
    );
    await expect(getMyTeamPersonAction(999)).resolves.toEqual({
      ok: false,
      error: "Employee not found in your team.",
    });
  });
});
