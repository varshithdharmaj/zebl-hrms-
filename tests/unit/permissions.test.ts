import { describe, expect, it } from "vitest";
import {
  assignableRolesFor,
  canAccessAdmin,
  canAccessEmployeeShell,
  canAccessHRAdministration,
  canAccessPlatformAdministration,
  canEditEmployeeProfilePhoto,
  canManageUserRoles,
  canAdministerEmployeeAccount,
  canModifyTargetUser,
  isEmployee,
  isHR,
  isManager,
  isSuperAdmin,
  isWorkforceMember,
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
    expect(canAccessHRAdministration("manager")).toBe(false);
    // Legacy alias tracks the same set.
    expect(canAccessAdmin("super_admin")).toBe(true);
    expect(canAccessAdmin("hr")).toBe(true);
    expect(canAccessAdmin("employee")).toBe(false);
    expect(canAccessAdmin("manager")).toBe(false);
  });

  it("restricts platform administration to super_admin", () => {
    expect(canAccessPlatformAdministration("super_admin")).toBe(true);
    expect(canAccessPlatformAdministration("hr")).toBe(false);
    expect(canAccessPlatformAdministration("employee")).toBe(false);
    expect(canAccessPlatformAdministration("manager")).toBe(false);
  });

  it("scopes the employee shell to employees and managers only", () => {
    expect(canAccessEmployeeShell("employee")).toBe(true);
    expect(canAccessEmployeeShell("manager")).toBe(true);
    expect(canAccessEmployeeShell("hr")).toBe(false);
    expect(canAccessEmployeeShell("super_admin")).toBe(false);
  });

  it("only super_admin may manage user roles", () => {
    expect(canManageUserRoles("super_admin")).toBe(true);
    expect(canManageUserRoles("hr")).toBe(false);
    expect(canManageUserRoles("employee")).toBe(false);
    expect(canManageUserRoles("manager")).toBe(false);
  });

  it("prevents privilege escalation by HR/employee/manager via user modification", () => {
    // Super Admin may modify any target, including Manager.
    expect(canModifyTargetUser("super_admin", "super_admin")).toBe(true);
    expect(canModifyTargetUser("super_admin", "hr")).toBe(true);
    expect(canModifyTargetUser("super_admin", "manager")).toBe(true);
    // HR cannot modify anyone (including super_admin) through role controls.
    expect(canModifyTargetUser("hr", "super_admin")).toBe(false);
    expect(canModifyTargetUser("hr", "employee")).toBe(false);
    expect(canModifyTargetUser("employee", "hr")).toBe(false);
    // Manager can never modify anyone, including themselves.
    expect(canModifyTargetUser("manager", "manager")).toBe(false);
    expect(canModifyTargetUser("manager", "employee")).toBe(false);
    expect(canModifyTargetUser("manager", "super_admin")).toBe(false);
  });

  it("only exposes assignable roles to super_admin, including manager", () => {
    expect(assignableRolesFor("super_admin")).toEqual([
      "super_admin",
      "hr",
      "manager",
      "employee",
    ]);
    expect(assignableRolesFor("hr")).toEqual([]);
    expect(assignableRolesFor("employee")).toEqual([]);
    expect(assignableRolesFor("manager")).toEqual([]);
  });

  it("allows HR to administer employees and managers but protects HR and Super Admin accounts", () => {
    expect(canAdministerEmployeeAccount("hr", "employee")).toBe(true);
    expect(canAdministerEmployeeAccount("hr", "manager")).toBe(true);
    expect(canAdministerEmployeeAccount("hr", "hr")).toBe(false);
    expect(canAdministerEmployeeAccount("hr", "super_admin")).toBe(false);
    expect(canAdministerEmployeeAccount("super_admin", "employee")).toBe(true);
    expect(canAdministerEmployeeAccount("super_admin", "manager")).toBe(true);
    expect(canAdministerEmployeeAccount("super_admin", "hr")).toBe(true);
    expect(canAdministerEmployeeAccount("super_admin", "super_admin")).toBe(true);
    // Manager administers no one's account, including their own reports.
    expect(canAdministerEmployeeAccount("manager", "employee")).toBe(false);
    expect(canAdministerEmployeeAccount("manager", "manager")).toBe(false);
  });

  it("MANAGER role identity is independent of team hierarchy", () => {
    expect(isManager("manager")).toBe(true);
    expect(isManager("employee")).toBe(false);
    expect(isWorkforceMember("manager")).toBe(true);
    expect(isWorkforceMember("employee")).toBe(true);
    expect(isWorkforceMember("hr")).toBe(false);
    expect(isWorkforceMember("super_admin")).toBe(false);
  });

  it("allows profile-photo edit for own employee or HR/admin targets", () => {
    expect(
      canEditEmployeeProfilePhoto({
        actorRole: "employee",
        actorEmployeeId: 20,
        targetEmployeeId: 20,
      })
    ).toBe(true);
    expect(
      canEditEmployeeProfilePhoto({
        actorRole: "employee",
        actorEmployeeId: 20,
        targetEmployeeId: 21,
      })
    ).toBe(false);
    expect(
      canEditEmployeeProfilePhoto({
        actorRole: "employee",
        actorEmployeeId: null,
        targetEmployeeId: 20,
      })
    ).toBe(false);
    expect(
      canEditEmployeeProfilePhoto({
        actorRole: "hr",
        actorEmployeeId: null,
        targetEmployeeId: 20,
      })
    ).toBe(true);
    expect(
      canEditEmployeeProfilePhoto({
        actorRole: "super_admin",
        actorEmployeeId: 1,
        targetEmployeeId: 99,
      })
    ).toBe(true);
    // Manager gets the same self-only rule as Employee — no team-wide grant from role.
    expect(
      canEditEmployeeProfilePhoto({
        actorRole: "manager",
        actorEmployeeId: 10,
        targetEmployeeId: 10,
      })
    ).toBe(true);
    expect(
      canEditEmployeeProfilePhoto({
        actorRole: "manager",
        actorEmployeeId: 10,
        targetEmployeeId: 20,
      })
    ).toBe(false);
  });
});
