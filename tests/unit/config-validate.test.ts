import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { validateApplicationConfig } from "@/lib/config/validate";

describe("application config validation", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-minimum-32-characters-long";
    process.env.DATABASE_URL = "postgresql://zebl:pass@localhost:5432/zebl_ams";
    process.env.APP_BASE_URL = "http://localhost:3000";
  });

  it("passes with valid postgres config", () => {
    const result = validateApplicationConfig();
    expect(result.ok).toBe(true);
  });

  it("fails when DATABASE_URL is sqlite", () => {
    process.env.DATABASE_URL = "file:./prisma/attendance_manager.db";
    const result = validateApplicationConfig();
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.field === "DATABASE_URL")).toBe(true);
  });

  it("warns when SMTP is missing", () => {
    delete process.env.SMTP_HOST;
    const result = validateApplicationConfig();
    expect(result.issues.some((i) => i.field === "SMTP_HOST")).toBe(true);
  });
});
