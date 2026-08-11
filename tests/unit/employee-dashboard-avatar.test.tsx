import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceHero } from "@/components/employee/dashboard/attendance-hero";
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

describe("Employee Dashboard AttendanceHero avatar", () => {
  it("renders ProfileAvatar with the default asset when no photo exists", () => {
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
    expect(html).toContain("/avatars/default-avatar.svg");
    expect(html).toContain("Varshith Kumar profile photo");
    expect(html).toContain("Varshith");
    expect(html).toContain("Update profile photo");
    expect(html).not.toContain("Upload photo");
    expect(html).not.toContain('type="file"');
  });

  it("falls back to the default avatar for Microsoft Graph photo URLs", () => {
    const html = renderToStaticMarkup(
      <AttendanceHero
        firstName="Varshith"
        fullName="Varshith Kumar"
        profilePhotoUrl={GRAPH_PHOTO_URL}
        displayDate="Tuesday, 11 August 2026"
        dateIso="2026-08-11"
        heroStatus={heroStatus}
        defaultStart="2026-08-01"
        defaultEnd="2026-08-31"
      />
    );

    expect(html).toContain(DEFAULT_PROFILE_AVATAR_SRC);
    expect(html).not.toContain("graph.microsoft.com");
    expect(html).not.toContain("Upload photo");
  });

  it("passes through a future displayable image URL", () => {
    const html = renderToStaticMarkup(
      <AttendanceHero
        firstName="Varshith"
        fullName="Varshith Kumar"
        profilePhotoUrl="https://cdn.example/avatar.png"
        displayDate="Tuesday, 11 August 2026"
        dateIso="2026-08-11"
        heroStatus={heroStatus}
        defaultStart="2026-08-01"
        defaultEnd="2026-08-31"
      />
    );

    expect(html).toContain("https://cdn.example/avatar.png");
    expect(html).not.toContain("Upload photo");
  });
});
