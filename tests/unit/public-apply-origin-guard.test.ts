import { describe, expect, it, vi, beforeEach } from "vitest";

function makeRequest(headers: Record<string, string>, url = "https://ignored.example/api/public/applications/start"): Request {
  return new Request(url, {
    method: "POST",
    headers,
  });
}

describe("isAllowedOrigin", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.APP_BASE_URL;
    delete process.env.VERCEL_URL;
  });

  // --- The actual incident this replaced: origin matching the request's own
  // Host/X-Forwarded-Host must work with ZERO env configuration — this is
  // the whole point of the fix (see origin-guard.ts's root-cause comment). ---

  it("allows a same-origin request via a direct Host header (dev, no APP_BASE_URL set, no reverse proxy in front)", async () => {
    const { isAllowedOrigin } = await import("@/lib/recruitment/public-apply/origin-guard");
    const request = makeRequest(
      { origin: "http://localhost:3000", host: "localhost:3000" },
      "http://localhost:3000/api/public/applications/start"
    );
    expect(isAllowedOrigin("http://localhost:3000", request)).toBe(true);
  });

  it("allows a same-origin request via X-Forwarded-Host + X-Forwarded-Proto (AWS ALB/CloudFront production)", async () => {
    const { isAllowedOrigin } = await import("@/lib/recruitment/public-apply/origin-guard");
    const request = makeRequest({
      origin: "https://ams.zebl.com",
      host: "10.0.1.23:3000", // internal container host — must NOT be what's checked
      "x-forwarded-host": "ams.zebl.com",
      "x-forwarded-proto": "https",
    });
    expect(isAllowedOrigin("https://ams.zebl.com", request)).toBe(true);
  });

  it("rejects a genuinely cross-site origin", async () => {
    const { isAllowedOrigin } = await import("@/lib/recruitment/public-apply/origin-guard");
    const request = makeRequest({
      host: "ams.zebl.com",
      "x-forwarded-host": "ams.zebl.com",
      "x-forwarded-proto": "https",
    });
    expect(isAllowedOrigin("https://evil.example.com", request)).toBe(false);
  });

  it("rejects www vs apex domain mismatch (genuinely different origins — fix at DNS/redirect level, not here)", async () => {
    const { isAllowedOrigin } = await import("@/lib/recruitment/public-apply/origin-guard");
    const request = makeRequest({
      host: "ams.zebl.com",
      "x-forwarded-host": "ams.zebl.com",
      "x-forwarded-proto": "https",
    });
    expect(isAllowedOrigin("https://www.ams.zebl.com", request)).toBe(false);
  });

  it("rejects http vs https protocol mismatch", async () => {
    const { isAllowedOrigin } = await import("@/lib/recruitment/public-apply/origin-guard");
    const request = makeRequest({
      host: "ams.zebl.com",
      "x-forwarded-host": "ams.zebl.com",
      "x-forwarded-proto": "https",
    });
    expect(isAllowedOrigin("http://ams.zebl.com", request)).toBe(false);
  });

  it("allows a missing Origin header (non-browser caller / older proxy)", async () => {
    const { isAllowedOrigin } = await import("@/lib/recruitment/public-apply/origin-guard");
    const request = makeRequest({ host: "ams.zebl.com" });
    expect(isAllowedOrigin(null, request)).toBe(true);
  });

  it("rejects a malformed Origin header", async () => {
    const { isAllowedOrigin } = await import("@/lib/recruitment/public-apply/origin-guard");
    const request = makeRequest({ host: "ams.zebl.com" });
    expect(isAllowedOrigin("not-a-valid-origin", request)).toBe(false);
  });

  it("also allows an explicitly configured APP_BASE_URL as a defensive fallback, even if it differs from Host", async () => {
    process.env.APP_BASE_URL = "https://alt.zebl.com";
    const { isAllowedOrigin } = await import("@/lib/recruitment/public-apply/origin-guard");
    const request = makeRequest({
      host: "ams.zebl.com",
      "x-forwarded-host": "ams.zebl.com",
      "x-forwarded-proto": "https",
    });
    expect(isAllowedOrigin("https://alt.zebl.com", request)).toBe(true);
  });

  it("does NOT silently allow an unset/misconfigured APP_BASE_URL to bypass the check (the original bug's blast radius, inverted)", async () => {
    // APP_BASE_URL unset entirely — this must not make every real request fail,
    // and must not make every fake origin succeed either.
    const { isAllowedOrigin } = await import("@/lib/recruitment/public-apply/origin-guard");
    const request = makeRequest({
      host: "ams.zebl.com",
      "x-forwarded-host": "ams.zebl.com",
      "x-forwarded-proto": "https",
    });
    expect(isAllowedOrigin("https://ams.zebl.com", request)).toBe(true); // real traffic still works
    expect(isAllowedOrigin("https://random-attacker.com", request)).toBe(false); // still rejected
  });
});
