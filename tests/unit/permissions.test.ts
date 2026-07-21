import { describe, expect, it } from "vitest";
import {
  assignableRolesFor,
  canAccessAdmin,
  canAccessEmployeeShell,
  canAccessHRAdministration,
  canAccessPlatformAdministration,
  canManageUserRoles,
  canManageLoginSessions,
  canAdministerEmployeeAccount,
  canModifyTargetUser,
  canViewAllLoginHistory,
  isEmployee,
  isHR,
  isSuperAdmin,
} from "@/lib/permissions";

describe("three-role permissions", () => {
  it("identifies each role", () => {
    expect(isSuperAdmin("super_admin")).toBe(true);
    expect(isHR("hr")).toBe(true);
    expect(isEmployee("employee")).toBe(true);
    expect(isSuperAdmin("hr")).toBe(false);
    expect(isHR("employee")).toBe(false);
  });

  it("grants HR administration (admin shell) to super_admin and hr only", () => {
    expect(canAccessHRAdministration("super_admin")).toBe(true);
    expect(canAccessHRAdministration("hr")).toBe(true);
    expect(canAccessHRAdministration("employee")).toBe(false);
    // Legacy alias tracks the same set.
    expect(canAccessAdmin("super_admin")).toBe(true);
    expect(canAccessAdmin("hr")).toBe(true);
    expect(canAccessAdmin("employee")).toBe(false);
  });

  it("restricts platform administration to super_admin", () => {
    expect(canAccessPlatformAdministration("super_admin")).toBe(true);
    expect(canAccessPlatformAdministration("hr")).toBe(false);
    expect(canAccessPlatformAdministration("employee")).toBe(false);
  });

  it("scopes the employee shell to employees", () => {
    expect(canAccessEmployeeShell("employee")).toBe(true);
    expect(canAccessEmployeeShell("hr")).toBe(false);
    expect(canAccessEmployeeShell("super_admin")).toBe(false);
  });

  it("only super_admin may manage user roles", () => {
    expect(canManageUserRoles("super_admin")).toBe(true);
    expect(canManageUserRoles("hr")).toBe(false);
    expect(canManageUserRoles("employee")).toBe(false);
  });

  it("prevents privilege escalation by HR/employee via user modification", () => {
    // Super Admin may modify any target.
    expect(canModifyTargetUser("super_admin", "super_admin")).toBe(true);
    expect(canModifyTargetUser("super_admin", "hr")).toBe(true);
    // HR cannot modify anyone (including super_admin) through role controls.
    expect(canModifyTargetUser("hr", "super_admin")).toBe(false);
    expect(canModifyTargetUser("hr", "employee")).toBe(false);
    expect(canModifyTargetUser("employee", "hr")).toBe(false);
  });

  it("only exposes assignable roles to super_admin", () => {
    expect(assignableRolesFor("super_admin")).toEqual(["super_admin", "hr", "employee"]);
    expect(assignableRolesFor("hr")).toEqual([]);
    expect(assignableRolesFor("employee")).toEqual([]);
  });

  it("allows HR to view organization login history but reserves session management for Super Admin", () => {
    expect(canViewAllLoginHistory("super_admin")).toBe(true);
    expect(canViewAllLoginHistory("hr")).toBe(true);
    expect(canViewAllLoginHistory("employee")).toBe(false);
    expect(canManageLoginSessions("super_admin")).toBe(true);
    expect(canManageLoginSessions("hr")).toBe(false);
    expect(canManageLoginSessions("employee")).toBe(false);
  });

  it("allows HR to administer employees but protects HR and Super Admin accounts", () => {
    expect(canAdministerEmployeeAccount("hr", "employee")).toBe(true);
    expect(canAdministerEmployeeAccount("hr", "hr")).toBe(false);
    expect(canAdministerEmployeeAccount("hr", "super_admin")).toBe(false);
    expect(canAdministerEmployeeAccount("super_admin", "employee")).toBe(true);
    expect(canAdministerEmployeeAccount("super_admin", "hr")).toBe(true);
    expect(canAdministerEmployeeAccount("super_admin", "super_admin")).toBe(true);
  });
});
