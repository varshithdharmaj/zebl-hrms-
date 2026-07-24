import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/employees/direct-reports", () => ({
  employeeHasDirectReports: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { employeeHasDirectReports } from "@/lib/employees/direct-reports";
import { hasDirectReportsNavAction } from "@/actions/employee-nav";

describe("hasDirectReportsNavAction", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    vi.mocked(employeeHasDirectReports).mockReset();
  });

  it("returns false when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(hasDirectReportsNavAction()).resolves.toBe(false);
    expect(employeeHasDirectReports).not.toHaveBeenCalled();
  });

  it("returns false for non-employee shell roles", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: "1",
      email: "hr@x.com",
      role: "hr",
      employeeId: 10,
      employeeName: null,
      mustChangePassword: false,
      sessionVersion: 1,
      authProvider: "local",
    });
    await expect(hasDirectReportsNavAction()).resolves.toBe(false);
    expect(employeeHasDirectReports).not.toHaveBeenCalled();
  });

  it("returns false when employee profile is not linked", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: "1",
      email: "e@x.com",
      role: "employee",
      employeeId: null,
      employeeName: null,
      mustChangePassword: false,
      sessionVersion: 1,
      authProvider: "local",
    });
    await expect(hasDirectReportsNavAction()).resolves.toBe(false);
  });

  it("returns the direct-reports result for employees", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: "1",
      email: "e@x.com",
      role: "employee",
      employeeId: 42,
      employeeName: "Pat",
      mustChangePassword: false,
      sessionVersion: 1,
      authProvider: "local",
    });
    vi.mocked(employeeHasDirectReports).mockResolvedValue(true);
    await expect(hasDirectReportsNavAction()).resolves.toBe(true);
    expect(employeeHasDirectReports).toHaveBeenCalledWith(42);

    vi.mocked(employeeHasDirectReports).mockResolvedValue(false);
    await expect(hasDirectReportsNavAction()).resolves.toBe(false);
  });
});
