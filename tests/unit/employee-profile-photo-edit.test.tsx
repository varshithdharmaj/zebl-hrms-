import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { AttendanceHero } from "@/components/employee/dashboard/attendance-hero";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { canEditEmployeeProfilePhoto } from "@/lib/permissions";
import { DEFAULT_PROFILE_AVATAR_SRC } from "@/lib/profile-avatar";
import type { HeroStatus } from "@/lib/attendance/hero-status";

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

const GRAPH_PHOTO_URL =
  "https://graph.microsoft.com/v1.0/users/abc-123/photo/$value";

function renderEmployeeProfileHeader(options: {
  actorRole: "employee" | "hr" | "super_admin";
  actorEmployeeId: number | null;
  targetEmployeeId: number;
  profilePhotoUrl?: string | null;
}) {
  const editable = canEditEmployeeProfilePhoto({
    actorRole: options.actorRole,
    actorEmployeeId: options.actorEmployeeId,
    targetEmployeeId: options.targetEmployeeId,
  });

  return renderToStaticMarkup(
    <WorkspacePageHeader
      leading={
        <ProfileAvatar
          imageUrl={options.profilePhotoUrl ?? null}
          alt="Employee profile photo"
          editable={editable}
          size="lg"
        />
      }
      title="Employee"
    />
  );
}

describe("Employee profile photo edit authorization UI", () => {
  it("shows upload controls when an employee views their own profile", () => {
    const html = renderEmployeeProfileHeader({
      actorRole: "employee",
      actorEmployeeId: 20,
      targetEmployeeId: 20,
      profilePhotoUrl: null,
    });
    expect(html).toContain(DEFAULT_PROFILE_AVATAR_SRC);
    expect(html).toContain("Upload photo");
    expect(html).toContain('type="file"');
  });

  it("hides upload controls when an employee views another employee", () => {
    const html = renderEmployeeProfileHeader({
      actorRole: "employee",
      actorEmployeeId: 20,
      targetEmployeeId: 21,
      profilePhotoUrl: null,
    });
    expect(html).toContain(DEFAULT_PROFILE_AVATAR_SRC);
    expect(html).not.toContain("Upload photo");
    expect(html).not.toContain('type="file"');
  });

  it("keeps HR/Admin able to edit any employee photo", () => {
    for (const role of ["hr", "super_admin"] as const) {
      const html = renderEmployeeProfileHeader({
        actorRole: role,
        actorEmployeeId: null,
        targetEmployeeId: 99,
        profilePhotoUrl: null,
      });
      expect(html).toContain("Upload photo");
    }
  });

  it("falls back to the default avatar for Graph photo URLs on an editable own profile", () => {
    const html = renderEmployeeProfileHeader({
      actorRole: "employee",
      actorEmployeeId: 20,
      targetEmployeeId: 20,
      profilePhotoUrl: GRAPH_PHOTO_URL,
    });
    expect(html).toContain(DEFAULT_PROFILE_AVATAR_SRC);
    expect(html).not.toContain("graph.microsoft.com");
    expect(html).toContain("Upload photo");
  });

  it("keeps the employee dashboard display-only", () => {
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
    expect(html).toContain(DEFAULT_PROFILE_AVATAR_SRC);
    expect(html).not.toContain("Upload photo");
    expect(html).not.toContain('type="file"');
    expect(html).toContain("Update profile photo");
    expect(html).toContain('href="/employee/profile"');
  });
});
