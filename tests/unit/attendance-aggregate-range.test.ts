import { describe, expect, it } from "vitest";
import {
  aggregateAttendanceForRange,
  assertPresentPartition,
} from "@/lib/attendance/aggregate-range";
import type { ClassifiedAttendanceRecord } from "@/lib/attendance/history-classification";
import type { AttendanceDayCategory, AttendanceRatioTier } from "@/lib/attendance/day-classification";

let nextId = 1;
function rec(
  category: AttendanceDayCategory,
  ratioTier: AttendanceRatioTier | null,
  overtimeMinutes = 0
): ClassifiedAttendanceRecord {
  return {
    id: nextId++,
    attendanceDate: new Date(2026, 6, nextId),
    checkIn: "09:00",
    checkOut: "18:00",
    workedMinutes: 0,
    overtimeMinutes,
    status: "Present",
    category,
    ratioTier,
    expectedWorkMinutes: 480,
    late: false,
    earlyCheckout: false,
    hasLeaveConflict: false,
    remarks: null,
  };
}

describe("aggregateAttendanceForRange — empty range", () => {
  it("returns zeros, not NaN, for an empty range", () => {
    expect(aggregateAttendanceForRange([])).toEqual({
      workingDays: 0,
      presentDays: 0,
      excellentDays: 0,
      shortHoursCount: 0,
      insufficientDataCount: 0,
      overtimeMinutes: 0,
      attendancePercent: 0,
    });
  });
});

describe("aggregateAttendanceForRange — Present Days (attended)", () => {
  it("counts below-target worked days as Present", () => {
    const result = aggregateAttendanceForRange([
      rec("PRESENT", "near_target"),
      rec("PRESENT", "partial"),
      rec("PRESENT", "very_low"),
    ]);
    expect(result.presentDays).toBe(3);
    expect(result.shortHoursCount).toBe(3);
    expect(result.excellentDays).toBe(0);
  });

  it("counts target and overtime worked days as Present and Excellent", () => {
    const result = aggregateAttendanceForRange([
      rec("PRESENT", "target"),
      rec("PRESENT", "overtime"),
    ]);
    expect(result.presentDays).toBe(2);
    expect(result.excellentDays).toBe(2);
    expect(result.shortHoursCount).toBe(0);
  });

  it("counts worked-on-holiday/weekly-off as Present regardless of schedule", () => {
    const result = aggregateAttendanceForRange([
      rec("WORKED_ON_HOLIDAY", "target"),
      rec("WORKED_ON_WEEKLY_OFF", "partial"),
    ]);
    expect(result.presentDays).toBe(2);
    expect(result.excellentDays).toBe(1);
    expect(result.shortHoursCount).toBe(1);
  });

  it("does not count leave, holiday, weekly off, absent, or insufficient data as Present", () => {
    const result = aggregateAttendanceForRange([
      rec("LEAVE", null),
      rec("HOLIDAY", null),
      rec("WEEKLY_OFF", null),
      rec("ABSENT", null),
      rec("INSUFFICIENT_DATA", null),
    ]);
    expect(result.presentDays).toBe(0);
    expect(result.excellentDays).toBe(0);
  });
});

describe("aggregateAttendanceForRange — Short Hours / Excellent partition", () => {
  it("counts very_low, partial, and near_target worked days as short hours", () => {
    const result = aggregateAttendanceForRange([
      rec("PRESENT", "very_low"),
      rec("PRESENT", "partial"),
      rec("PRESENT", "near_target"),
    ]);
    expect(result.shortHoursCount).toBe(3);
  });

  it("does NOT count INSUFFICIENT_DATA as short hours", () => {
    const result = aggregateAttendanceForRange([
      rec("PRESENT", "partial"),
      rec("INSUFFICIENT_DATA", null),
    ]);
    expect(result.shortHoursCount).toBe(1);
    expect(result.insufficientDataCount).toBe(1);
  });

  it("does not count target or overtime as short hours", () => {
    const result = aggregateAttendanceForRange([rec("PRESENT", "target"), rec("PRESENT", "overtime")]);
    expect(result.shortHoursCount).toBe(0);
  });

  it("Present === Excellent + Short hours", () => {
    const result = aggregateAttendanceForRange([
      rec("PRESENT", "target"),
      rec("PRESENT", "overtime"),
      rec("PRESENT", "near_target"),
      rec("PRESENT", "partial"),
    ]);
    expect(assertPresentPartition(result)).toBe(true);
  });
});

describe("aggregateAttendanceForRange — still-open (in-progress) present day", () => {
  it("does not count a checked-in-but-not-checked-out day as Short Hours, even with a low ratio", () => {
    const openDay = rec("PRESENT", "very_low");
    openDay.checkOut = null;
    const result = aggregateAttendanceForRange([openDay]);
    expect(result.presentDays).toBe(1);
    expect(result.shortHoursCount).toBe(0);
    expect(result.excellentDays).toBe(0);
  });

  it("does not count a checked-in-but-not-checked-out day as Excellent either", () => {
    const openDay = rec("PRESENT", "overtime");
    openDay.checkOut = null;
    const result = aggregateAttendanceForRange([openDay]);
    expect(result.presentDays).toBe(1);
    expect(result.excellentDays).toBe(0);
    expect(result.shortHoursCount).toBe(0);
  });
});

describe("aggregateAttendanceForRange — Insufficient Data", () => {
  it("counts INSUFFICIENT_DATA separately from present and short hours", () => {
    const result = aggregateAttendanceForRange([
      rec("INSUFFICIENT_DATA", null),
      rec("INSUFFICIENT_DATA", null),
    ]);
    expect(result.insufficientDataCount).toBe(2);
    expect(result.presentDays).toBe(0);
    expect(result.shortHoursCount).toBe(0);
  });
});

describe("aggregateAttendanceForRange — Overtime minutes", () => {
  it("sums overtimeMinutes across all records regardless of category", () => {
    const result = aggregateAttendanceForRange([
      rec("PRESENT", "overtime", 90),
      rec("WORKED_ON_WEEKLY_OFF", "partial", 120),
      rec("ABSENT", null, 0),
    ]);
    expect(result.overtimeMinutes).toBe(210);
  });
});

describe("aggregateAttendanceForRange — mixed range", () => {
  it("produces internally consistent totals", () => {
    const records = [
      rec("PRESENT", "target"),
      rec("PRESENT", "overtime", 60),
      rec("PRESENT", "near_target"),
      rec("PRESENT", "partial"),
      rec("INSUFFICIENT_DATA", null),
      rec("ABSENT", null),
      rec("LEAVE", null),
      rec("HOLIDAY", null),
      rec("WEEKLY_OFF", null),
      rec("WORKED_ON_WEEKLY_OFF", "target"),
    ];
    const result = aggregateAttendanceForRange(records);

    expect(result.workingDays).toBe(10);
    expect(result.presentDays).toBe(5);
    expect(result.excellentDays).toBe(3);
    expect(result.shortHoursCount).toBe(2);
    expect(result.insufficientDataCount).toBe(1);
    expect(result.overtimeMinutes).toBe(60);
    expect(result.attendancePercent).toBe(50); // 5/10
    expect(assertPresentPartition(result)).toBe(true);
  });
});
