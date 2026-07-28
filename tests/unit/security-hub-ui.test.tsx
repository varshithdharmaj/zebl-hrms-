import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoginSessionStatus, UserRole } from "@/generated/prisma/client";
import { SecurityHub } from "@/components/security/security-hub";
import type { LoginSessionListRow } from "@/lib/security/login-history-service";
import { normalizeSessionView } from "@/lib/security/login-history-service";

const device: LoginSessionListRow = {
  id: "sess-current",
  attemptedEmail: null,
  loginAt: new Date("2026-07-01T10:00:00.000Z"),
  logoutAt: null,
  lastActivityAt: new Date("2026-07-01T12:00:00.000Z"),
  status: LoginSessionStatus.active,
  ipAddress: "192.0.2.10",
  browser: "Chrome",
  browserVersion: "126",
  device: "Desktop",
  operatingSystem: "Windows",
  sessionDuration: null,
  failureReason: null,
  isCurrent: true,
  user: { id: "u1", email: "a@zebl.com", role: UserRole.employee },
  employee: {
    id: 1,
    name: "Ada Lovelace",
    employeeCode: "E001",
    department: "Engineering",
  },
};

describe("Security Hub UI", () => {
  it("renders MVP hierarchy: header, current device, sessions — no overview or placeholders", () => {
    const session = normalizeSessionView(device, {
      currentSessionId: device.id,
      canRevoke: true,
    });

    const html = renderToStaticMarkup(
      <SecurityHub
        mode="employee"
        title="Security & Sessions"
        description="Review devices signed into your account."
        summary={{
          activeSessionCount: 1,
          lastLogin: {
            id: device.id,
            loginAt: device.loginAt,
            browser: device.browser,
            operatingSystem: device.operatingSystem,
            ipAddress: device.ipAddress,
            device: device.device,
          },
          lastFailedLogin: null,
          currentDevice: device,
        }}
        sessions={{ rows: [session], total: 1, page: 1, pageSize: 25 }}
        filterParams={{}}
      />
    );

    expect(html).toContain("Security &amp; Sessions");
    expect(html).toContain("Current Device");
    expect(html).toContain("This Device");
    expect(html).toContain("Sessions");
    expect(html).toContain("Chrome");
    expect(html).toContain("Current");
    expect(html).not.toContain("Security Overview");
    expect(html).not.toContain("Coming Soon");
    expect(html).not.toContain("Security Features");
    expect(html).not.toContain("Active Sessions");
    expect(html).not.toContain("Recent Login Activity");
    expect(html).not.toContain('role="tablist"');
  });

  it("keeps search and status visible while collapsing advanced filters", () => {
    const session = normalizeSessionView(device, {
      currentSessionId: device.id,
      canRevoke: true,
    });

    const html = renderToStaticMarkup(
      <SecurityHub
        mode="admin"
        title="Security & Sessions"
        description="Monitor sessions."
        summary={{
          activeSessionCount: 1,
          lastLogin: null,
          lastFailedLogin: null,
          currentDevice: device,
        }}
        sessions={{ rows: [session], total: 1, page: 1, pageSize: 25 }}
        filterParams={{}}
        allowFailedStatus
        departments={["Engineering"]}
      />
    );

    expect(html).toContain("Search");
    expect(html).toContain("Status");
    expect(html).toContain("Advanced filters");
    expect(html).toContain('name="role"');
    expect(html).toContain('name="department"');
  });
});
