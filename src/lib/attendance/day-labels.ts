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

// Simplified 4-tier attendance activity scale — professional, muted, theme-compatible
export const RATIO_TIER_COLOR: Record<AttendanceRatioTier, string> = {
  very_low: "#991b1b", // Deep muted red — minimal work
  partial: "#c2410c", // Muted orange — below target
  near_target: "#65a30d", // Attractive light green — approaching target
  target: "#15803d", // Rich deep green — target met (includes overtime)
  overtime: "#15803d", // Same as target — overtime not visually distinct
};

// Activity graph cells don't display text (date shown in tooltip only)
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
