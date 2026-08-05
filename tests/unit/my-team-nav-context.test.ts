import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/employees/direct-reports", () => ({
  employeeHasDirectReports: vi.fn(),
}));

import { employeeHasDirectReports } from "@/lib/employees/direct-reports";
import { resolveMyTeamNavContext } from "@/lib/people-scope/nav-context";

describe("resolveMyTeamNavContext", () => {
  beforeEach(() => {
    vi.mocked(employeeHasDirectReports).mockReset();
  });

  it("maps line-manager eligibility into nav flags", async () => {
    vi.mocked(employeeHasDirectReports).mockResolvedValue(true);
    await expect(resolveMyTeamNavContext(7)).resolves.toEqual({
      employeeId: 7,
      isLineManager: true,
      showApprovalsNav: true,
      showMyTeamGroup: true,
    });
    expect(employeeHasDirectReports).toHaveBeenCalledWith(7);
  });

  it("clears nav flags when not a line manager", async () => {
    vi.mocked(employeeHasDirectReports).mockResolvedValue(false);
    await expect(resolveMyTeamNavContext(8)).resolves.toEqual({
      employeeId: 8,
      isLineManager: false,
      showApprovalsNav: false,
      showMyTeamGroup: false,
    });
  });
});
