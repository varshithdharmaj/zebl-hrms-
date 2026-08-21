import { startOfDay } from "@/lib/utils";

/**
 * Fixed lower bound for the heatmap's display range — every employee sees the same
 * start date regardless of when they joined. A deliberate, product-specified anchor
 * for the current attendance dataset, not derived from `today`'s year.
 */
export const HEATMAP_DISPLAY_START_DATE = new Date(2026, 0, 1);

/**
 * The heatmap's display lower bound. Always `HEATMAP_DISPLAY_START_DATE`, clamped so
 * it never lands after `today` (guards the range from inverting if `today` is, for
 * whatever reason, earlier than the anchor).
 */
export function resolveHeatmapStartDate(today: Date): Date {
  const todayMidnight = startOfDay(today);
  const anchor = startOfDay(HEATMAP_DISPLAY_START_DATE);
  return anchor > todayMidnight ? todayMidnight : anchor;
}
