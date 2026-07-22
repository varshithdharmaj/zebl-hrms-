import { describe, expect, it } from "vitest";
import { isShortHoursDay, CATEGORY_BADGE_CLASS } from "@/components/employee/attendance-history-table";
import type { ClassifiedAttendanceRecord } from "@/lib/attendance/history-classification";
import type { AttendanceDayCategory } from "@/lib/attendance/day-classification";

function baseRecord(overrides: Partial<ClassifiedAttendanceRecord> = {}): ClassifiedAttendanceRecord {
  return {
    id: 1,
    attendanceDate: new Date(2026, 6, 15),
    checkIn: "09:00",
    checkOut: "18:00",
    workedMinutes: 480,
    overtimeMinutes: 0,
    status: "Present",
    category: "PRESENT",
    ratioTier: "target",
    expectedWorkMinutes: 480,
    late: false,
    earlyCheckout: false,
    hasLeaveConflict: false,
    remarks: null,
    ...overrides,
  };
}

describe("isShortHoursDay", () => {
  it("is true for a completed day at very_low or partial ratio", () => {
    expect(isShortHoursDay(baseRecord({ ratioTier: "very_low", checkOut: "13:00" }))).toBe(true);
    expect(isShortHoursDay(baseRecord({ ratioTier: "partial", checkOut: "13:00" }))).toBe(true);
  });

  it("is false while the day is still in progress (no checkout yet), even at a low ratio", () => {
    expect(isShortHoursDay(baseRecord({ ratioTier: "very_low", checkOut: null }))).toBe(false);
  });

  it("is false for near_target, target, and overtime", () => {
    expect(isShortHoursDay(baseRecord({ ratioTier: "near_target" }))).toBe(false);
    expect(isShortHoursDay(baseRecord({ ratioTier: "target" }))).toBe(false);
    expect(isShortHoursDay(baseRecord({ ratioTier: "overtime" }))).toBe(false);
  });

  it("is false for non-worked categories with no ratio tier", () => {
    expect(isShortHoursDay(baseRecord({ category: "ABSENT", ratioTier: null }))).toBe(false);
  });
});

describe("CATEGORY_BADGE_CLASS", () => {
  it("has a distinct entry for every canonical category, matching the Heatmap's palette", () => {
    const categories: AttendanceDayCategory[] = [
      "PRESENT",
      "WORKED_ON_HOLIDAY",
      "WORKED_ON_WEEKLY_OFF",
      "ABSENT",
      "LEAVE",
      "HOLIDAY",
      "WEEKLY_OFF",
      "INSUFFICIENT_DATA",
    ];
    for (const category of categories) {
      expect(CATEGORY_BADGE_CLASS[category]).toBeTruthy();
    }
    // Leave must never share Absent's color — this is the exact contradiction the audit found.
    expect(CATEGORY_BADGE_CLASS.LEAVE).not.toBe(CATEGORY_BADGE_CLASS.ABSENT);
    expect(CATEGORY_BADGE_CLASS.LEAVE).toContain("violet");
    expect(CATEGORY_BADGE_CLASS.ABSENT).toContain("rose");
  });
});
