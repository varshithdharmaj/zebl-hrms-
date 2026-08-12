import { describe, expect, it } from "vitest";
import { DASHBOARD_HISTORY_PREVIEW_LIMIT } from "@/lib/data/constants";

describe("DASHBOARD_HISTORY_PREVIEW_LIMIT", () => {
  it("keeps the employee dashboard history preview at 7 rows", () => {
    expect(DASHBOARD_HISTORY_PREVIEW_LIMIT).toBe(7);
  });
});
