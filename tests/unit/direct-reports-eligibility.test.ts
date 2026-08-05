import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/people-scope/engine", () => ({
  PeopleScopeEngine: {
    isLineManager: vi.fn(),
  },
}));

import { PeopleScopeEngine } from "@/lib/people-scope/engine";
import { employeeHasDirectReports } from "@/lib/employees/direct-reports";

describe("employeeHasDirectReports", () => {
  beforeEach(() => {
    vi.mocked(PeopleScopeEngine.isLineManager).mockReset();
  });

  it("delegates to PeopleScopeEngine.isLineManager", async () => {
    vi.mocked(PeopleScopeEngine.isLineManager).mockResolvedValue(true);
    await expect(employeeHasDirectReports(42)).resolves.toBe(true);
    expect(PeopleScopeEngine.isLineManager).toHaveBeenCalledWith(42);

    vi.mocked(PeopleScopeEngine.isLineManager).mockResolvedValue(false);
    // React cache may memoize per employeeId within the same process — use a new id
    await expect(employeeHasDirectReports(43)).resolves.toBe(false);
    expect(PeopleScopeEngine.isLineManager).toHaveBeenCalledWith(43);
  });
});
