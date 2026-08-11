import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AttendanceHero } from "@/components/employee/dashboard/attendance-hero";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { buildEmployeeShellNav } from "@/lib/navigation/employee-shell-nav";
import { canEditEmployeeProfilePhoto } from "@/lib/permissions";
import { DEFAULT_PROFILE_AVATAR_SRC } from "@/lib/profile-avatar";
import type { HeroStatus } from "@/lib/attendance/hero-status";

vi.mock("next/navigation", () => ({
  usePathname: () => "/employee/dashboard",
}));

vi.mock("@/actions/auth", () => ({
  logoutAction: vi.fn(),
}));

const heroStatus: HeroStatus = {
  category: "PRESENT",
  label: "Present",
  subLabel: null,
  tone: "success",
  isLiveInProgress: false,
  checkInTime: "09:00",
  checkOutTime: null,
  workedLabel: "1h",
  remainingLabel: null,
  progressPercent: 12,
  actionHint: null,
  badges: {
    late: false,
    earlyCheckout: false,
    overtime: false,
    shortHours: false,
    leaveConflict: false,
  },
};

describe("Employee profile photo discovery journey", () => {
  it("includes Profile → /employee/profile in employee shell navigation", () => {
    const profile = buildEmployeeShellNav(false)
      .find((g) => g.group === "Workspace")
      ?.items.find((i) => i.label === "Profile");
    expect(profile?.href).toBe("/employee/profile");
  });

  it("renders Profile in the employee sidebar (desktop/mobile shared nav)", () => {
    const html = renderToStaticMarkup(
      <AppSidebar role="employee" userName="Varshith Kumar" />
    );
    expect(html).toContain('href="/employee/profile"');
    expect(html).toContain(">Profile<");
    expect(html).toContain('aria-label="Open profile for Varshith Kumar"');
  });

  it("keeps Profile reachable when recruitment-ops-only nav is active", () => {
    const html = renderToStaticMarkup(
      <AppSidebar
        role="employee"
        userName="Ops User"
        recruitmentOpsOnly
      />
    );
    expect(html).toContain('href="/employee/profile"');
    expect(html).toContain(">Profile<");
  });

  it("shows a dashboard CTA to Profile without upload controls", () => {
    const html = renderToStaticMarkup(
      <AttendanceHero
        firstName="Varshith"
        fullName="Varshith Kumar"
        profilePhotoUrl={null}
        displayDate="Tuesday, 11 August 2026"
        dateIso="2026-08-11"
        heroStatus={heroStatus}
        defaultStart="2026-08-01"
        defaultEnd="2026-08-31"
      />
    );
    expect(html).toContain('href="/employee/profile"');
    expect(html).toContain("Update profile photo");
    expect(html).toContain(DEFAULT_PROFILE_AVATAR_SRC);
    expect(html).not.toContain("Upload photo");
    expect(html).not.toContain('type="file"');
  });

  it("shows Upload photo on the own-profile header", () => {
    const editable = canEditEmployeeProfilePhoto({
      actorRole: "employee",
      actorEmployeeId: 20,
      targetEmployeeId: 20,
    });
    expect(editable).toBe(true);

    const html = renderToStaticMarkup(
      <WorkspacePageHeader
        leading={
          <ProfileAvatar
            imageUrl={null}
            alt="Own profile photo"
            editable={editable}
            size="lg"
          />
        }
        title="My Profile"
      />
    );
    expect(html).toContain(DEFAULT_PROFILE_AVATAR_SRC);
    expect(html).toContain("Upload photo");
    expect(html).toContain('type="file"');
  });

  it("keeps other-employee profiles read-only", () => {
    const editable = canEditEmployeeProfilePhoto({
      actorRole: "employee",
      actorEmployeeId: 20,
      targetEmployeeId: 21,
    });
    expect(editable).toBe(false);

    const html = renderToStaticMarkup(
      <ProfileAvatar alt="Other employee" editable={editable} />
    );
    expect(html).not.toContain("Upload photo");
  });
});
