import { describe, expect, it } from "vitest";
import {
  getCellColor,
  buildTooltipText,
} from "@/components/employee/dashboard/attendance-heatmap";
import {
  CATEGORY_COLOR,
  HEATMAP_COLOR,
  RATIO_TIER_COLOR,
  isExcellentTier,
} from "@/lib/attendance/day-labels";
import type { AttendanceDayResult } from "@/lib/attendance/day-classification";

function baseDay(overrides: Partial<AttendanceDayResult> = {}): AttendanceDayResult {
  return {
    date: new Date(2026, 6, 15),
    category: "PRESENT",
    scheduleType: "working_day",
    workedMinutes: 0,
    overtimeMinutes: 0,
    ratio: null,
    ratioTier: null,
    checkIn: null,
    checkOut: null,
    remark: null,
    holidayName: null,
    leaveType: null,
    hasLeaveConflict: false,
    ...overrides,
  };
}

describe("getCellColor", () => {
  it("maps below-target worked days to Present and target+ to Excellent", () => {
    expect(getCellColor(baseDay({ ratioTier: "very_low" }))).toBe(HEATMAP_COLOR.present);
    expect(getCellColor(baseDay({ ratioTier: "partial" }))).toBe(HEATMAP_COLOR.present);
    expect(getCellColor(baseDay({ ratioTier: "near_target" }))).toBe(HEATMAP_COLOR.present);
    expect(getCellColor(baseDay({ ratioTier: "target" }))).toBe(HEATMAP_COLOR.excellent);
    expect(getCellColor(baseDay({ ratioTier: "overtime" }))).toBe(HEATMAP_COLOR.excellent);
  });

  it("keeps RATIO_TIER_COLOR in sync with getCellColor", () => {
    expect(getCellColor(baseDay({ ratioTier: "very_low" }))).toBe(RATIO_TIER_COLOR.very_low);
    expect(getCellColor(baseDay({ ratioTier: "target" }))).toBe(RATIO_TIER_COLOR.target);
  });

  it("returns distinct colors for special categories", () => {
    const holiday = getCellColor(baseDay({ category: "HOLIDAY", ratioTier: null }));
    const weeklyOff = getCellColor(baseDay({ category: "WEEKLY_OFF", ratioTier: null }));
    const leave = getCellColor(baseDay({ category: "LEAVE", ratioTier: null }));
    const absent = getCellColor(baseDay({ category: "ABSENT", ratioTier: null }));

    expect(holiday).toBe(CATEGORY_COLOR.HOLIDAY);
    expect(weeklyOff).toBe(CATEGORY_COLOR.WEEKLY_OFF);
    expect(leave).toBe(CATEGORY_COLOR.LEAVE);
    expect(absent).toBe(CATEGORY_COLOR.ABSENT);
    expect(new Set([holiday, weeklyOff, leave, absent]).size).toBe(4);
  });
});

describe("isExcellentTier", () => {
  it("treats target and overtime as excellent", () => {
    expect(isExcellentTier("target")).toBe(true);
    expect(isExcellentTier("overtime")).toBe(true);
    expect(isExcellentTier("near_target")).toBe(false);
    expect(isExcellentTier(null)).toBe(false);
  });
});

describe("buildTooltipText", () => {
  it("includes date, status, worked, and expected for a normal present day", () => {
    const text = buildTooltipText(
      baseDay({ category: "PRESENT", ratioTier: "target", workedMinutes: 480, checkIn: "09:00", checkOut: "17:00" }),
      480
    );
    expect(text).toContain("Worked: 8h");
    expect(text).toContain("Expected: 8h");
    expect(text).toContain("Excellent");
    expect(text).toContain("Check-in: 09:00");
    expect(text).toContain("Check-out: 17:00");
  });

  it("includes overtime minutes only when actually present", () => {
    const withOvertime = buildTooltipText(
      baseDay({ category: "PRESENT", ratioTier: "overtime", workedMinutes: 560, overtimeMinutes: 80 }),
      480
    );
    expect(withOvertime).toContain("Overtime: 1h 20m");

    const withoutOvertime = buildTooltipText(
      baseDay({ category: "PRESENT", ratioTier: "target", workedMinutes: 480, overtimeMinutes: 0 }),
      480
    );
    expect(withoutOvertime).not.toContain("Overtime");
  });

  it("does not fabricate worked/expected minutes for non-worked categories", () => {
    const text = buildTooltipText(baseDay({ category: "ABSENT" }), 480);
    expect(text).not.toContain("Worked");
    expect(text).not.toContain("Expected");
  });

  it("surfaces holiday name only when present", () => {
    const text = buildTooltipText(
      baseDay({ category: "WORKED_ON_HOLIDAY", ratioTier: "target", workedMinutes: 480, holidayName: "Festival" }),
      480
    );
    expect(text).toContain("Holiday: Festival");
  });

  it("surfaces an approved-leave conflict note when attendance exists on a leave day", () => {
    const text = buildTooltipText(
      baseDay({ category: "PRESENT", ratioTier: "target", workedMinutes: 480, hasLeaveConflict: true }),
      480
    );
    expect(text).toContain("approved leave date");
  });
});

describe("RATIO_TIER_COLOR coverage", () => {
  it("has an entry for every tier used by getRatioTier", () => {
    const tiers = ["very_low", "partial", "near_target", "target", "overtime"] as const;
    for (const tier of tiers) {
      expect(RATIO_TIER_COLOR[tier]).toBeTruthy();
    }
  });
});
