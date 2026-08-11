/**
 * Permanent Recruitment ops capability (User.recruitmentOpsAccess) + regression guards.
 */
import { describe, expect, it } from "vitest";
import { canAccessAdmin, canAccessEmployeeShell } from "@/lib/permissions";
import {
  canAccessRecruitmentAdministration,
  hasRecruitmentOpsAccess,
  isAdminRecruitmentPath,
  isRecruitmentTestManager,
} from "@/lib/recruitment/permissions/recruitment-test-manager";
import {
  mockEmployeeSession,
  mockHrSession,
  mockManagerSession,
  mockSuperAdminSession,
  mockTestManager1Session,
  mockTestManager2Session,
} from "../fixtures/session";
import { buildEmployeeShellNav } from "@/lib/navigation/employee-shell-nav";

describe("hasRecruitmentOpsAccess / canAccessRecruitmentAdministration", () => {
  it("allows Manager 1 when recruitmentOpsAccess is true", () => {
    const s = mockTestManager1Session();
    expect(s.recruitmentOpsAccess).toBe(true);
    expect(hasRecruitmentOpsAccess(s)).toBe(true);
    expect(isRecruitmentTestManager(s)).toBe(true);
    expect(canAccessRecruitmentAdministration(s)).toBe(true);
  });

  it("allows Manager 2 when recruitmentOpsAccess is true", () => {
    const s = mockTestManager2Session();
    expect(hasRecruitmentOpsAccess(s)).toBe(true);
    expect(canAccessRecruitmentAdministration(s)).toBe(true);
  });

  it("denies when recruitmentOpsAccess is false / missing", () => {
    const emp = mockEmployeeSession();
    expect(hasRecruitmentOpsAccess(emp)).toBe(false);
    expect(canAccessRecruitmentAdministration(emp)).toBe(false);

    const legacy = { role: "employee" as const };
    expect(hasRecruitmentOpsAccess(legacy)).toBe(false);
    expect(canAccessRecruitmentAdministration(legacy)).toBe(false);
  });

  it("denies other line managers without the capability", () => {
    const mgr = mockManagerSession(55);
    expect(mgr.recruitmentOpsAccess).toBe(false);
    expect(canAccessRecruitmentAdministration(mgr)).toBe(false);
  });

  it("HR and Super Admin retain recruitment administration via role", () => {
    expect(canAccessRecruitmentAdministration(mockHrSession())).toBe(true);
    expect(canAccessRecruitmentAdministration(mockSuperAdminSession())).toBe(
      true
    );
    expect(hasRecruitmentOpsAccess(mockHrSession())).toBe(false);
  });

  it("does not grant general /admin via recruitmentOpsAccess", () => {
    expect(canAccessAdmin(mockTestManager1Session().role)).toBe(false);
    expect(canAccessAdmin(mockTestManager2Session().role)).toBe(false);
    expect(canAccessEmployeeShell(mockTestManager1Session().role)).toBe(true);
  });

  it("email alone does not grant access (no allowlist auth)", () => {
    expect(
      canAccessRecruitmentAdministration({
        role: "employee",
        recruitmentOpsAccess: false,
      })
    ).toBe(false);
  });
});

describe("isAdminRecruitmentPath — middleware carve-out scope", () => {
  it("matches recruitment workspace paths only", () => {
    expect(isAdminRecruitmentPath("/admin/recruitment")).toBe(true);
    expect(isAdminRecruitmentPath("/admin/recruitment/jobs")).toBe(true);
    expect(isAdminRecruitmentPath("/admin/recruitment/candidates")).toBe(true);
    expect(isAdminRecruitmentPath("/admin/recruitment/pipeline")).toBe(true);
    expect(isAdminRecruitmentPath("/admin/recruitment/offers")).toBe(true);
    expect(isAdminRecruitmentPath("/admin/recruitment/conversions")).toBe(true);
  });

  it("does not match unrelated admin modules", () => {
    expect(isAdminRecruitmentPath("/admin/dashboard")).toBe(false);
    expect(isAdminRecruitmentPath("/admin/employees")).toBe(false);
    expect(isAdminRecruitmentPath("/admin/payroll-attendance")).toBe(false);
    expect(isAdminRecruitmentPath("/admin/settings")).toBe(false);
    expect(isAdminRecruitmentPath("/admin/audit")).toBe(false);
    expect(isAdminRecruitmentPath("/admin/recruitment-settings")).toBe(false);
  });
});

describe("employee shell — Recruitment link only with ops flag", () => {
  it("hides Recruitment link by default", () => {
    const labels = buildEmployeeShellNav(false, false, false)
      .flatMap((g) => g.items)
      .map((i) => i.label);
    expect(labels).not.toContain("Recruitment");
  });

  it("shows Recruitment link when ops flag is set", () => {
    const items = buildEmployeeShellNav(false, false, true).flatMap(
      (g) => g.items
    );
    expect(items.some((i) => i.href === "/admin/recruitment")).toBe(true);
  });

  it("hides Interviews when Recruitment ops link is shown", () => {
    const items = buildEmployeeShellNav(false, true, true).flatMap(
      (g) => g.items
    );
    expect(items.some((i) => i.href === "/admin/recruitment")).toBe(true);
    expect(items.some((i) => i.href === "/employee/interviews")).toBe(false);
  });
});
