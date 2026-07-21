import { describe, expect, it } from "vitest";
import { parseUserAgent } from "@/lib/security/request-context";

describe("request security context", () => {
  it("parses desktop Chrome on Windows", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"
    );
    expect(result).toMatchObject({
      browser: "Chrome",
      browserVersion: "126.0.0.0",
      device: "Desktop",
      operatingSystem: "Windows",
    });
  });

  it("parses mobile Safari on iOS", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1"
    );
    expect(result).toMatchObject({
      browser: "Safari",
      browserVersion: "17.5",
      device: "Mobile",
      operatingSystem: "iOS",
    });
  });
});
