import { describe, expect, it } from "vitest";
import { HEATMAP_DISPLAY_START_DATE, resolveHeatmapStartDate } from "@/lib/attendance/heatmap-start-date";
import { toISODate } from "@/lib/utils";

describe("resolveHeatmapStartDate", () => {
  it("is fixed at January 1, 2026 regardless of the current date within the year", () => {
    expect(toISODate(resolveHeatmapStartDate(new Date(2026, 7, 20)))).toBe("2026-01-01");
    expect(toISODate(resolveHeatmapStartDate(new Date(2026, 11, 31)))).toBe("2026-01-01");
  });

  it("stays January 1, 2026 in a future leap year (2028) — the anchor is fixed, not year-relative", () => {
    expect(toISODate(resolveHeatmapStartDate(new Date(2028, 1, 29)))).toBe("2026-01-01");
  });

  it("stays January 1, 2026 right at a month boundary", () => {
    expect(toISODate(resolveHeatmapStartDate(new Date(2026, 0, 31)))).toBe("2026-01-01");
    expect(toISODate(resolveHeatmapStartDate(new Date(2026, 1, 1)))).toBe("2026-01-01");
  });

  it("is unaffected by a Date constructed with a sub-midnight time component (no UTC/local off-by-one)", () => {
    const lateNight = new Date(2026, 7, 20, 23, 59, 59, 999);
    expect(toISODate(resolveHeatmapStartDate(lateNight))).toBe("2026-01-01");
  });

  it("clamps to today if today is somehow before the anchor, instead of inverting the range", () => {
    const beforeAnchor = new Date(2025, 11, 15);
    expect(toISODate(resolveHeatmapStartDate(beforeAnchor))).toBe(toISODate(beforeAnchor));
  });

  it("HEATMAP_DISPLAY_START_DATE is exactly January 1, 2026", () => {
    expect(toISODate(HEATMAP_DISPLAY_START_DATE)).toBe("2026-01-01");
  });
});
