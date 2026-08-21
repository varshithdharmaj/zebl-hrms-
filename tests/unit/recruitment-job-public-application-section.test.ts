import { describe, expect, it } from "vitest";
import { buildPublicApplyUrl } from "@/components/recruitment/jobs/job-public-application-section";

describe("buildPublicApplyUrl", () => {
  it("builds the public apply URL from the deployment-safe app base URL and stable slug", () => {
    expect(buildPublicApplyUrl("https://ams.example.com", "backend-engineer")).toBe(
      "https://ams.example.com/apply/backend-engineer"
    );
  });

  it("never hardcodes a domain — uses whatever base URL is passed in", () => {
    expect(buildPublicApplyUrl("http://localhost:3000", "backend-engineer")).toBe(
      "http://localhost:3000/apply/backend-engineer"
    );
    expect(buildPublicApplyUrl("https://staging.example.com", "backend-engineer")).toBe(
      "https://staging.example.com/apply/backend-engineer"
    );
  });

  it("strips a trailing slash on the base URL to avoid a double slash", () => {
    expect(buildPublicApplyUrl("https://ams.example.com/", "backend-engineer")).toBe(
      "https://ams.example.com/apply/backend-engineer"
    );
  });

  it("returns null when the job has no slug yet (never published)", () => {
    expect(buildPublicApplyUrl("https://ams.example.com", null)).toBeNull();
  });

  it("never exposes an internal id in the generated link", () => {
    const url = buildPublicApplyUrl("https://ams.example.com", "backend-engineer");
    expect(url).not.toMatch(/[a-z0-9]{20,}/i); // no cuid-shaped internal id
  });
});
