import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

vi.mock("@/lib/config/env", () => ({
  getEnv: (key: string) => process.env[key],
}));

import { authorizeCronOrAdmin, getCronSecrets } from "@/lib/auth/cron-auth";
import { GET, POST } from "@/app/api/integrations/process/route";

describe("cron authorizeCronOrAdmin", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue(null);
  });

  it("rejects missing bearer when no admin session", async () => {
    const ok = await authorizeCronOrAdmin(new Request("http://localhost/x"), ["correct-secret"]);
    expect(ok).toBe(false);
  });

  it("rejects invalid bearer", async () => {
    const req = new Request("http://localhost/x", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const ok = await authorizeCronOrAdmin(req, ["correct-secret"]);
    expect(ok).toBe(false);
  });

  it("rejects empty configured secrets even with empty bearer", async () => {
    const req = new Request("http://localhost/x", {
      headers: { authorization: "Bearer " },
    });
    const ok = await authorizeCronOrAdmin(req, ["", undefined]);
    expect(ok).toBe(false);
  });

  it("accepts a valid bearer secret", async () => {
    const req = new Request("http://localhost/x", {
      headers: { authorization: "Bearer correct-secret" },
    });
    const ok = await authorizeCronOrAdmin(req, ["correct-secret"]);
    expect(ok).toBe(true);
  });

  it("does not treat an admin with mustChangePassword as authorized", async () => {
    getSession.mockResolvedValue({
      id: "hr-1",
      role: "hr",
      authProvider: "local",
      mustChangePassword: true,
    });
    const ok = await authorizeCronOrAdmin(new Request("http://localhost/x"), ["correct-secret"]);
    expect(ok).toBe(false);
  });
});

describe("GET /api/integrations/process", () => {
  it("does not mutate — returns 405", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});

describe("POST /api/integrations/process", () => {
  it("returns 401 without a secret", async () => {
    const res = await POST(new Request("http://localhost/api/integrations/process", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});

describe("getCronSecrets", () => {
  it("does not expose empty strings", () => {
    const prev = process.env.INTEGRATION_CRON_SECRET;
    delete process.env.INTEGRATION_CRON_SECRET;
    const secrets = getCronSecrets();
    expect(secrets.integration).toBeUndefined();
    if (prev !== undefined) process.env.INTEGRATION_CRON_SECRET = prev;
  });
});
