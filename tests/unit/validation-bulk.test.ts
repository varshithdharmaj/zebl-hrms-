import { describe, expect, it } from "vitest";
import { bulkLeaveItemsSchema } from "@/lib/validation";
import { safeParseWithSchema } from "@/lib/validation/parse";

describe("bulkLeaveItemsSchema", () => {
  it("accepts valid batch", () => {
    const result = safeParseWithSchema(bulkLeaveItemsSchema, [
      { leaveId: 1, version: 0 },
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects empty batch", () => {
    const result = safeParseWithSchema(bulkLeaveItemsSchema, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No items");
  });

  it("rejects oversized batch", () => {
    const items = Array.from({ length: 26 }, (_, i) => ({
      leaveId: i + 1,
      version: 0,
    }));
    const result = safeParseWithSchema(bulkLeaveItemsSchema, items);
    expect(result.ok).toBe(false);
  });
});
