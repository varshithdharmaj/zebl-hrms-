import { describe, expect, it } from "vitest";
import { checkForBot, MIN_FORM_ELAPSED_MS } from "@/lib/recruitment/public-apply/bot-check";

describe("checkForBot", () => {
  it("accepts an empty honeypot field with plausible timing", () => {
    expect(checkForBot({ website: "", formRenderedAt: Date.now() - MIN_FORM_ELAPSED_MS - 500 })).toEqual({
      blocked: false,
    });
  });

  it("accepts a request with no honeypot/timing signal at all (older/no-JS client)", () => {
    expect(checkForBot({})).toEqual({ blocked: false });
  });

  it("rejects a populated honeypot field", () => {
    expect(checkForBot({ website: "http://spam.example.com" })).toEqual({
      blocked: true,
      reason: "honeypot",
    });
  });

  it("rejects a whitespace-only honeypot the same as populated (no bypass)", () => {
    // Deliberately NOT trimmed-to-empty leniency — matches the real check.
    expect(checkForBot({ website: "   x   " }).blocked).toBe(true);
  });

  it("rejects a submission that arrives faster than a human could plausibly fill the form", () => {
    expect(checkForBot({ formRenderedAt: Date.now() - 100 })).toEqual({
      blocked: true,
      reason: "timing",
    });
  });

  it("accepts a submission right at the elapsed-time boundary and beyond", () => {
    expect(checkForBot({ formRenderedAt: Date.now() - MIN_FORM_ELAPSED_MS - 1 }).blocked).toBe(false);
  });

  it("does not penalize a client clock that's ahead of the server (negative elapsed)", () => {
    expect(checkForBot({ formRenderedAt: Date.now() + 5000 })).toEqual({ blocked: false });
  });

  it("honeypot takes priority even when timing would also pass", () => {
    expect(
      checkForBot({ website: "spam", formRenderedAt: Date.now() - 10_000 })
    ).toEqual({ blocked: true, reason: "honeypot" });
  });
});
