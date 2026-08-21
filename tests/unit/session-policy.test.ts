import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["AUTH_IDLE_TIMEOUT_MINUTES", "AUTH_SESSION_MAX_HOURS"] as const;
const originalEnv: Record<string, string | undefined> = {};

async function loadPolicy() {
  vi.resetModules();
  return import("@/lib/auth/session-policy");
}

describe("session-policy", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("defaults to a 30-minute idle timeout and a 12-hour absolute lifetime", async () => {
    delete process.env.AUTH_IDLE_TIMEOUT_MINUTES;
    delete process.env.AUTH_SESSION_MAX_HOURS;

    const policy = await loadPolicy();

    expect(policy.IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000);
    expect(policy.SESSION_MAX_HOURS).toBe(12);
    expect(policy.SESSION_MAX_LIFETIME_SECONDS).toBe(12 * 60 * 60);
    expect(policy.SESSION_MAX_LIFETIME_JWT).toBe("12h");
  });

  it("honors configured overrides", async () => {
    process.env.AUTH_IDLE_TIMEOUT_MINUTES = "15";
    process.env.AUTH_SESSION_MAX_HOURS = "8";

    const policy = await loadPolicy();

    expect(policy.IDLE_TIMEOUT_MS).toBe(15 * 60 * 1000);
    expect(policy.SESSION_MAX_HOURS).toBe(8);
    expect(policy.SESSION_MAX_LIFETIME_JWT).toBe("8h");
  });

  it("falls back to defaults for invalid or non-positive overrides", async () => {
    process.env.AUTH_IDLE_TIMEOUT_MINUTES = "not-a-number";
    process.env.AUTH_SESSION_MAX_HOURS = "-5";

    const policy = await loadPolicy();

    expect(policy.IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000);
    expect(policy.SESSION_MAX_HOURS).toBe(12);
  });
});
