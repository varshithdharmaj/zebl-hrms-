import { describe, expect, it } from "vitest";
import {
  buildPublicIntakeStorageKey,
  isSafePublicIntakeKey,
  monthPartitionFor,
} from "@/lib/recruitment/shared/storage-paths";

describe("public-intake storage key safety", () => {
  it("builds a month-partitioned key under the submission id", () => {
    const key = buildPublicIntakeStorageKey("sub-1", "resume.pdf", "2026-08");
    expect(key).toBe("public-intake/2026-08/sub-1/resume.pdf");
  });

  it("sanitizes an unsafe file name", () => {
    const key = buildPublicIntakeStorageKey("sub-1", "../../etc/passwd", "2026-08");
    expect(key).not.toContain("..");
    expect(key.startsWith("public-intake/2026-08/sub-1/")).toBe(true);
  });

  it("accepts a key that matches its own submission + partition prefix", () => {
    const key = buildPublicIntakeStorageKey("sub-1", "resume.pdf", "2026-08");
    expect(isSafePublicIntakeKey("sub-1", "2026-08", key)).toBe(true);
  });

  it("rejects a key belonging to a different submission (path-traversal-adjacent)", () => {
    const key = buildPublicIntakeStorageKey("sub-2", "resume.pdf", "2026-08");
    expect(isSafePublicIntakeKey("sub-1", "2026-08", key)).toBe(false);
  });

  it("rejects a key containing a traversal sequence", () => {
    expect(isSafePublicIntakeKey("sub-1", "2026-08", "public-intake/2026-08/sub-1/../../secret")).toBe(false);
  });

  it("derives a stable UTC year-month partition", () => {
    expect(monthPartitionFor(new Date(Date.UTC(2026, 0, 15)))).toBe("2026-01");
    expect(monthPartitionFor(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-12");
  });
});
