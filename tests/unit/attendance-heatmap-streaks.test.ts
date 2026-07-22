import { describe, expect, it } from "vitest";
import { calculateStreaks } from "@/lib/attendance/streak-calculator";
import type { AttendanceDayResult } from "@/lib/attendance/day-classification";

function day(
  dateStr: string,
  category: AttendanceDayResult["category"],
  ratioTier: AttendanceDayResult["ratioTier"] = null
): AttendanceDayResult {
  const [year, month, dayNum] = dateStr.split("-").map(Number);
  return {
    date: new Date(year, month - 1, dayNum),
    category,
    scheduleType: "working_day",
    workedMinutes: ratioTier ? 480 : 0,
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

describe("calculateStreaks — basic functionality", () => {
  it("returns zero streaks for an empty array", () => {
    expect(calculateStreaks([])).toEqual({
      currentStreak: 0,
      bestStreak: 0,
      targetDaysCount: 0,
    });
  });

  it("counts a single qualifying target day", () => {
    const result = calculateStreaks([day("2026-07-15", "PRESENT", "target")]);
    expect(result).toEqual({
      currentStreak: 1,
      bestStreak: 1,
      targetDaysCount: 1,
    });
  });

  it("counts consecutive target days as current and best streak", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "target"),
      day("2026-07-03", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(3);
    expect(result.bestStreak).toBe(3);
    expect(result.targetDaysCount).toBe(3);
  });

  it("counts overtime days as qualifying", () => {
    const days = [
      day("2026-07-01", "PRESENT", "overtime"),
      day("2026-07-02", "PRESENT", "overtime"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(2);
    expect(result.bestStreak).toBe(2);
    expect(result.targetDaysCount).toBe(2);
  });

  it("counts WORKED_ON_HOLIDAY and WORKED_ON_WEEKLY_OFF as qualifying if tier is target", () => {
    const days = [
      day("2026-07-01", "WORKED_ON_HOLIDAY", "target"),
      day("2026-07-02", "WORKED_ON_WEEKLY_OFF", "overtime"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(2);
    expect(result.bestStreak).toBe(2);
    expect(result.targetDaysCount).toBe(2);
  });
});

describe("calculateStreaks — neutral days do not break streak", () => {
  it("preserves streak across a holiday", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "target"),
      day("2026-07-03", "HOLIDAY"),
      day("2026-07-04", "PRESENT", "target"),
      day("2026-07-05", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(4);
    expect(result.bestStreak).toBe(4);
    expect(result.targetDaysCount).toBe(4);
  });

  it("preserves streak across a weekly off", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "WEEKLY_OFF"),
      day("2026-07-03", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(2);
    expect(result.bestStreak).toBe(2);
  });

  it("preserves streak across approved leave", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "LEAVE"),
      day("2026-07-03", "LEAVE"),
      day("2026-07-04", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(2);
    expect(result.bestStreak).toBe(2);
  });

  it("preserves streak across multiple consecutive neutral days", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "WEEKLY_OFF"),
      day("2026-07-03", "HOLIDAY"),
      day("2026-07-04", "LEAVE"),
      day("2026-07-05", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(2);
    expect(result.bestStreak).toBe(2);
  });
});

describe("calculateStreaks — breaking days reset streak", () => {
  it("breaks streak on absent", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "target"),
      day("2026-07-03", "ABSENT"),
      day("2026-07-04", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(1); // Only the last day
    expect(result.bestStreak).toBe(2); // First two days
  });

  it("breaks streak on insufficient data", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "INSUFFICIENT_DATA"),
      day("2026-07-03", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
  });

  it("breaks streak on very_low tier", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "very_low"),
      day("2026-07-03", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
  });

  it("breaks streak on partial tier", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "partial"),
      day("2026-07-03", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
  });

  it("breaks streak on near_target tier", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "near_target"),
      day("2026-07-03", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
  });
});

describe("calculateStreaks — best streak", () => {
  it("finds the longest streak in a mixed month", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"), // Streak 1: 2 days
      day("2026-07-02", "PRESENT", "target"),
      day("2026-07-03", "ABSENT"), // Break
      day("2026-07-04", "PRESENT", "target"), // Streak 2: 3 days (best)
      day("2026-07-05", "WEEKLY_OFF"), // Neutral
      day("2026-07-06", "PRESENT", "target"),
      day("2026-07-07", "HOLIDAY"), // Neutral
      day("2026-07-08", "PRESENT", "target"),
      day("2026-07-09", "INSUFFICIENT_DATA"), // Break
      day("2026-07-10", "PRESENT", "target"), // Streak 3: 1 day
    ];
    const result = calculateStreaks(days);
    expect(result.bestStreak).toBe(3);
    expect(result.currentStreak).toBe(1); // Last qualifying day
  });

  it("handles best streak at the beginning of the month", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "target"),
      day("2026-07-03", "PRESENT", "target"),
      day("2026-07-04", "ABSENT"),
      day("2026-07-05", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.bestStreak).toBe(3);
    expect(result.currentStreak).toBe(1);
  });

  it("handles best streak at the end of the month", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "ABSENT"),
      day("2026-07-03", "PRESENT", "target"),
      day("2026-07-04", "PRESENT", "target"),
      day("2026-07-05", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days);
    expect(result.bestStreak).toBe(3);
    expect(result.currentStreak).toBe(3);
  });
});

describe("calculateStreaks — current streak with trailing neutral days", () => {
  it("ignores trailing weekly offs when calculating current streak", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "target"),
      day("2026-07-03", "WEEKLY_OFF"),
      day("2026-07-04", "WEEKLY_OFF"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(2);
  });

  it("ignores trailing holidays when calculating current streak", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "HOLIDAY"),
      day("2026-07-03", "HOLIDAY"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(1);
  });

  it("current streak stops at last breaking day before neutral trailing days", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "ABSENT"),
      day("2026-07-03", "WEEKLY_OFF"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(0); // Absent broke it
  });
});

describe("calculateStreaks — future dates excluded", () => {
  it("excludes future dates from current streak", () => {
    const today = new Date(2026, 6, 5); // July 5, 2026
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "target"),
      day("2026-07-03", "PRESENT", "target"),
      day("2026-07-04", "PRESENT", "target"),
      day("2026-07-05", "PRESENT", "target"),
      day("2026-07-06", "PRESENT", "target"), // Future
      day("2026-07-07", "PRESENT", "target"), // Future
    ];
    const result = calculateStreaks(days, today);
    expect(result.currentStreak).toBe(5);
    expect(result.targetDaysCount).toBe(5); // Only up to today
  });

  it("handles all days being in the future", () => {
    const today = new Date(2026, 5, 30); // June 30, 2026
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "target"),
    ];
    const result = calculateStreaks(days, today);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(0);
    expect(result.targetDaysCount).toBe(0);
  });
});

describe("calculateStreaks — complex real-world scenarios", () => {
  it("typical mixed attendance month", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"), // +1
      day("2026-07-02", "PRESENT", "target"), // +1
      day("2026-07-03", "PRESENT", "target"), // +1
      day("2026-07-04", "WEEKLY_OFF"), // Neutral
      day("2026-07-05", "WEEKLY_OFF"), // Neutral
      day("2026-07-06", "PRESENT", "target"), // +1 (streak = 4)
      day("2026-07-07", "PRESENT", "partial"), // Break
      day("2026-07-08", "PRESENT", "target"), // +1 (new streak)
      day("2026-07-09", "PRESENT", "target"), // +1
      day("2026-07-10", "LEAVE"), // Neutral
      day("2026-07-11", "LEAVE"), // Neutral
      day("2026-07-12", "WEEKLY_OFF"), // Neutral
      day("2026-07-13", "PRESENT", "target"), // +1 (streak = 3)
      day("2026-07-14", "ABSENT"), // Break
      day("2026-07-15", "PRESENT", "overtime"), // +1 (new streak)
    ];
    const result = calculateStreaks(days);
    expect(result.bestStreak).toBe(4); // Days 1-3, 6
    expect(result.currentStreak).toBe(1); // Last day only
    expect(result.targetDaysCount).toBe(8);
  });

  it("month ending with long vacation", () => {
    const days = [
      day("2026-07-01", "PRESENT", "target"),
      day("2026-07-02", "PRESENT", "target"),
      day("2026-07-03", "PRESENT", "target"),
      day("2026-07-04", "LEAVE"),
      day("2026-07-05", "LEAVE"),
      day("2026-07-06", "LEAVE"),
      day("2026-07-07", "LEAVE"),
      day("2026-07-08", "LEAVE"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(3); // Leave doesn't break it
    expect(result.bestStreak).toBe(3);
  });

  it("month with no qualifying days", () => {
    const days = [
      day("2026-07-01", "ABSENT"),
      day("2026-07-02", "ABSENT"),
      day("2026-07-03", "WEEKLY_OFF"),
      day("2026-07-04", "HOLIDAY"),
      day("2026-07-05", "INSUFFICIENT_DATA"),
    ];
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(0);
    expect(result.targetDaysCount).toBe(0);
  });

  it("perfect attendance month", () => {
    const days = Array.from({ length: 22 }, (_, i) =>
      day(`2026-07-${String(i + 1).padStart(2, "0")}`, "PRESENT", "target")
    );
    const result = calculateStreaks(days);
    expect(result.currentStreak).toBe(22);
    expect(result.bestStreak).toBe(22);
    expect(result.targetDaysCount).toBe(22);
  });
});
