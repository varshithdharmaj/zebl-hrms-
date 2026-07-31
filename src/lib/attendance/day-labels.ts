import type { AttendanceDayCategory, AttendanceRatioTier } from "@/lib/attendance/day-classification";

// Shared presentation labels/colors for the canonical classifier's category and ratio
// tier, used by both the Heatmap (client component) and the History table (server
// components). Deliberately has no "use client" and no React import — a plain data
// module can cross the server/client boundary safely; a "use client" file's non-component
// exports cannot (Next.js only preserves the client-reference for the component itself).

export const CATEGORY_LABEL: Record<AttendanceDayCategory, string> = {
  HOLIDAY: "Holiday",
  WEEKLY_OFF: "Weekly off",
  LEAVE: "Approved leave",
  ABSENT: "Absent",
  PRESENT: "Present",
  INSUFFICIENT_DATA: "Insufficient data",
  WORKED_ON_WEEKLY_OFF: "Worked on weekly off",
  WORKED_ON_HOLIDAY: "Worked on holiday",
};

/** CSS custom properties — resolve against light/dark theme tokens in globals.css. */
export const HEATMAP_COLOR = {
  present: "var(--heatmap-present)",
  excellent: "var(--heatmap-excellent)",
  absent: "var(--heatmap-absent)",
  leave: "var(--heatmap-leave)",
  holiday: "var(--heatmap-holiday)",
  weeklyOff: "var(--heatmap-weekly-off)",
  insufficient: "var(--heatmap-insufficient)",
  empty: "var(--heatmap-empty)",
  cellFg: "var(--heatmap-cell-fg)",
  excellentFg: "var(--heatmap-excellent-fg)",
} as const;

/**
 * Worked-day intensity → visual swatch.
 * Below-target tiers share Present (soft green); target/overtime share Excellent (rich green).
 * Classifier tiers are unchanged — this is presentation only.
 */
export const RATIO_TIER_COLOR: Record<AttendanceRatioTier, string> = {
  very_low: HEATMAP_COLOR.present,
  partial: HEATMAP_COLOR.present,
  near_target: HEATMAP_COLOR.present,
  target: HEATMAP_COLOR.excellent,
  overtime: HEATMAP_COLOR.excellent,
};

export const CATEGORY_COLOR: Record<AttendanceDayCategory, string> = {
  PRESENT: HEATMAP_COLOR.present,
  WORKED_ON_WEEKLY_OFF: HEATMAP_COLOR.present,
  WORKED_ON_HOLIDAY: HEATMAP_COLOR.present,
  ABSENT: HEATMAP_COLOR.absent,
  LEAVE: HEATMAP_COLOR.leave,
  HOLIDAY: HEATMAP_COLOR.holiday,
  WEEKLY_OFF: HEATMAP_COLOR.weeklyOff,
  INSUFFICIENT_DATA: HEATMAP_COLOR.insufficient,
};

/** True when the tier maps to the Excellent (target-met) swatch. */
export function isExcellentTier(ratioTier: AttendanceRatioTier | null | undefined): boolean {
  return ratioTier === "target" || ratioTier === "overtime";
}

export function heatmapCellForeground(ratioTier: AttendanceRatioTier | null | undefined): string {
  return isExcellentTier(ratioTier) ? HEATMAP_COLOR.excellentFg : HEATMAP_COLOR.cellFg;
}

// Activity graph cells don't display status text as fill labels (date numeral only)
export const RATIO_TIER_TEXT_CLASS: Record<AttendanceRatioTier, string> = {
  very_low: "text-transparent",
  partial: "text-transparent",
  near_target: "text-transparent",
  target: "text-transparent",
  overtime: "text-transparent",
};

export const RATIO_TIER_LABEL: Record<AttendanceRatioTier, string> = {
  very_low: "Very low hours",
  partial: "Partial hours",
  near_target: "Near target",
  target: "Target hours",
  overtime: "Overtime",
};
