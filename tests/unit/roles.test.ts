import { describe, expect, it } from "vitest";
import {
  isAppUserRole,
  parseAppUserRole,
  ROLE_LABELS,
  USER_ROLES,
  WORKFORCE_ROLES,
} from "@/lib/roles";

describe("AppUserRole — manager", () => {
  it("manager is a valid AppUserRole", () => {
    expect(USER_ROLES).toContain("manager");
    expect(isAppUserRole("manager")).toBe(true);
    expect(parseAppUserRole("manager")).toBe("manager");
  });

  it("manager role labels correctly", () => {
    expect(ROLE_LABELS.manager).toBe("Manager");
  });

  it("manager is a workforce role (has self-service, unlike hr/super_admin)", () => {
    expect(WORKFORCE_ROLES).toContain("manager");
    expect(WORKFORCE_ROLES).toContain("employee");
    expect(WORKFORCE_ROLES).not.toContain("hr");
    expect(WORKFORCE_ROLES).not.toContain("super_admin");
  });

  it("rejects unknown role strings", () => {
    expect(isAppUserRole("department_manager")).toBe(false);
    expect(parseAppUserRole("MANAGER")).toBeNull(); // case-sensitive, matches enum convention
  });
});
