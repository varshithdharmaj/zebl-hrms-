import { describe, expect, it } from "vitest";
import type { AttendanceDayResult } from "@/lib/attendance/day-classification";
import {
  buildHeatmapMonthStats,
  buildMonthWeekRanges,
  monthKeyFromDate,
} from "@/lib/attendance/heatmap-month-stats";

function day(
  dateStr: string,
  category: AttendanceDayResult["category"],
  ratioTier: AttendanceDayResult["ratioTier"] = null,
  workedMinutes = 0
): AttendanceDayResult {
  const [year, month, dayNum] = dateStr.split("-").map(Number);
  return {
    date: new Date(year!, month! - 1, dayNum),
    category,
    scheduleType: "working_day",
    workedMinutes,
    overtimeMinutes: 0,
    ratio: ratioTier ? 100 : null,
    ratioTier,
    checkIn: null,
    checkOut: null,
    remark: null,
    holidayName: null,
    leaveType: null,
    hasLeaveConflict: false,
  };
}

describe("buildHeatmapMonthStats", () => {
  it("aggregates present, excellent, absent, leave and attendance %", () => {
    const stats = buildHeatmapMonthStats([
      day("2026-07-01", "PRESENT", "near_target", 360),
      day("2026-07-02", "PRESENT", "target", 480),
      day("2026-07-03", "ABSENT"),
      day("2026-07-04", "LEAVE"),
      day("2026-07-05", "WEEKLY_OFF"),
    ]);

    const july = stats.get("2026-07");
    expect(july).toBeTruthy();
    expect(july!.presentDays).toBe(1);
    expect(july!.excellentDays).toBe(1);
    expect(july!.absentDays).toBe(1);
    expect(july!.leaveDays).toBe(1);
    // attended 2 / (2 present+excellent + 1 absent) = 67%
    expect(july!.attendancePercent).toBe(67);
    expect(july!.averageWorkedMinutes).toBe(420);
  });

  it("returns null attendance % when month has no countable working outcomes", () => {
    const stats = buildHeatmapMonthStats([
      day("2026-01-01", "HOLIDAY"),
      day("2026-01-02", "WEEKLY_OFF"),
    ]);
    expect(stats.get("2026-01")!.attendancePercent).toBeNull();
    expect(stats.get("2026-01")!.averageWorkedMinutes).toBeNull();
  });
});

describe("buildMonthWeekRanges", () => {
  it("spans week indices for each month present in the grid", () => {
    const weeks: (AttendanceDayResult | null)[][] = [
      [day("2026-06-28", "PRESENT", "target"), null, null, null, null, null, null],
      [day("2026-07-05", "PRESENT", "target"), null, null, null, null, null, null],
      [day("2026-07-12", "ABSENT"), null, null, null, null, null, null],
    ];
    const ranges = buildMonthWeekRanges(weeks);
    expect(ranges.find((r) => r.monthKey === "2026-06")).toEqual({
      monthKey: "2026-06",
      label: expect.any(String),
      startWeek: 0,
      endWeek: 0,
    });
    expect(ranges.find((r) => r.monthKey === "2026-07")).toMatchObject({
      monthKey: "2026-07",
      startWeek: 1,
      endWeek: 2,
    });
  });
});

describe("monthKeyFromDate", () => {
  it("formats local YYYY-MM", () => {
    expect(monthKeyFromDate(new Date(2026, 6, 31))).toBe("2026-07");
  });
});
