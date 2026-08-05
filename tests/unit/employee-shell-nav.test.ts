import { describe, expect, it } from "vitest";
import { buildEmployeeShellNav } from "@/lib/navigation/employee-shell-nav";

describe("buildEmployeeShellNav", () => {
  it("always includes Workspace and Security with stable items", () => {
    const groups = buildEmployeeShellNav(false);
    expect(groups.map((g) => g.group)).toEqual(["Workspace", "Security"]);

    const workspace = groups.find((g) => g.group === "Workspace");
    expect(workspace?.items.map((i) => ({ href: i.href, label: i.label }))).toEqual([
      { href: "/employee/dashboard", label: "Dashboard" },
      { href: "/employee/attendance", label: "History" },
      { href: "/employee/leaves", label: "Leaves" },
      { href: "/employee/tickets", label: "My Tickets" },
      { href: "/employee/settings", label: "Settings" },
    ]);

    const security = groups.find((g) => g.group === "Security");
    expect(security?.items.map((i) => ({ href: i.href, label: i.label }))).toEqual([
      { href: "/employee/security", label: "Security & Sessions" },
    ]);
  });

  it("hides My Team when showMyTeamGroup is false", () => {
    const groups = buildEmployeeShellNav(false);
    expect(groups.some((g) => g.group === "My Team")).toBe(false);
    const workspaceHrefs = groups
      .find((g) => g.group === "Workspace")
      ?.items.map((i) => i.href);
    expect(workspaceHrefs).not.toContain("/employee/approvals");
  });

  it("renders My Team group when showMyTeamGroup is true", () => {
    const groups = buildEmployeeShellNav(true);
    expect(groups.map((g) => g.group)).toEqual(["Workspace", "My Team", "Security"]);

    const myTeam = groups.find((g) => g.group === "My Team");
    expect(myTeam?.items.map((i) => ({ href: i.href, label: i.label }))).toEqual([
      { href: "/employee/team", label: "Overview" },
      { href: "/employee/approvals", label: "Approvals" },
      { href: "/employee/team/people", label: "People" },
      { href: "/employee/team/attendance", label: "Attendance" },
      { href: "/employee/team/leave", label: "Leave" },
      { href: "/employee/team/calendar", label: "Calendar" },
    ]);
  });

  it("keeps Approvals on the existing /employee/approvals route", () => {
    const approvals = buildEmployeeShellNav(true)
      .find((g) => g.group === "My Team")
      ?.items.find((i) => i.label === "Approvals");
    expect(approvals?.href).toBe("/employee/approvals");
  });

  it("does not include Hiring or Reports", () => {
    const labels = buildEmployeeShellNav(true)
      .flatMap((g) => g.items)
      .map((i) => i.label);
    expect(labels).not.toContain("Hiring");
    expect(labels).not.toContain("Reports");
  });
});
