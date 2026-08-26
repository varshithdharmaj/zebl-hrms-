import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  canAccessEmployeeShell,
  canAccessManagerShell,
  canApproveLeave,
} from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

const baseSession = (role: SessionUser["role"]): SessionUser => ({
  id: "u1",
  email: "u@test.com",
  role,
  employeeId: 1,
  employeeName: "Test",
  sessionVersion: 1,
  authProvider: "local",
});

describe("role permissions", () => {
  it("restricts admin shell to admin and hr_admin", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("hr_admin")).toBe(true);
    expect(canAccessAdmin("manager")).toBe(false);
    expect(canAccessAdmin("employee")).toBe(false);
  });

  it("allows managers to approve leave", () => {
    expect(canApproveLeave("manager")).toBe(true);
    expect(canApproveLeave("employee")).toBe(false);
  });

  it("scopes shell access by role", () => {
    expect(canAccessManagerShell("manager")).toBe(true);
    expect(canAccessManagerShell("admin")).toBe(false);
    expect(canAccessEmployeeShell("employee")).toBe(true);
    expect(canAccessEmployeeShell(baseSession("hr_admin").role)).toBe(false);
  });
});
