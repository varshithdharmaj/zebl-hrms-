import { describe, expect, it } from "vitest";
import { generateUniqueJobSlug, slugifyJobTitle } from "@/lib/recruitment/shared/slug";

describe("slugifyJobTitle", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyJobTitle("Senior Software Engineer")).toBe("senior-software-engineer");
  });

  it("strips unsafe characters", () => {
    expect(slugifyJobTitle("C++ / .NET Developer (Remote!)")).toBe("c-net-developer-remote");
  });

  it("falls back to a default for an empty/unsafe-only title", () => {
    expect(slugifyJobTitle("!!!")).toBe("job");
  });

  it("never contains a path separator or internal id shape", () => {
    const slug = slugifyJobTitle("Backend Engineer / Platform");
    expect(slug).not.toMatch(/[/\\]/);
  });
});

describe("generateUniqueJobSlug", () => {
  it("returns the base slug when free", async () => {
    const slug = await generateUniqueJobSlug("Product Manager", async () => false);
    expect(slug).toBe("product-manager");
  });

  it("appends a numeric suffix on collision", async () => {
    const taken = new Set(["product-manager", "product-manager-2"]);
    const slug = await generateUniqueJobSlug("Product Manager", async (c) => taken.has(c));
    expect(slug).toBe("product-manager-3");
  });
});
