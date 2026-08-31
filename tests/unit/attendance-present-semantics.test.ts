import { describe, expect, it } from "vitest";
import {
  getEffectiveAttendanceDayType,
  isBelowTargetPresentDay,
  isExcellentPresentDay,
  isPresentDay,
  type AttendanceDayInput,
} from "@/lib/attendance/day-classification";
import type { WeeklySchedule } from "@/lib/attendance/schedule-resolver";

const schedule: WeeklySchedule = {
  mondayWorking: true,
  tuesdayWorking: true,
  wednesdayWorking: true,
  thursdayWorking: true,
  fridayWorking: true,
  saturdayWorking: false,
  sundayWorking: false,
};

const workingDay = new Date(2026, 6, 20);

function baseInput(overrides: Partial<AttendanceDayInput> = {}): AttendanceDayInput {
  return {
    date: workingDay,
    attendanceRecord: null,
    holiday: null,
    approvedLeave: null,
    weeklySchedule: schedule,
    dateOverride: null,
    expectedWorkMinutes: 480,
    ...overrides,
  };
}

function punched(workedMinutes: number) {
  return {
    checkIn: "09:00",
    checkOut: "18:00",
    workedMinutes,
    overtimeMinutes: 0,
    remarks: null,
  };
}

describe("P0-1 canonical Present / Excellent / below-target tiers", () => {
  it("Test 1 — below target (7h / 8h) is Present + below-target, not Excellent", () => {
    const day = getEffectiveAttendanceDayType(
      baseInput({ attendanceRecord: punched(420) })
    );
    expect(day.category).toBe("PRESENT");
    expect(day.ratioTier).toBe("near_target"); // 420/480 = 87.5% → near_target
    expect(isPresentDay(day.category, day.ratioTier)).toBe(true);
    expect(isBelowTargetPresentDay(day.category, day.ratioTier, day.checkOut)).toBe(true);
    expect(isExcellentPresentDay(day.category, day.ratioTier, day.checkOut)).toBe(false);
  });

  it("Test 2 — exactly target (8h / 8h) is Present + Excellent", () => {
    const day = getEffectiveAttendanceDayType(
      baseInput({ attendanceRecord: punched(480) })
    );
    expect(day.category).toBe("PRESENT");
    expect(day.ratioTier).toBe("target");
    expect(isPresentDay(day.category, day.ratioTier)).toBe(true);
    expect(isExcellentPresentDay(day.category, day.ratioTier, day.checkOut)).toBe(true);
    expect(isBelowTargetPresentDay(day.category, day.ratioTier, day.checkOut)).toBe(false);
  });

  it("Test 3 — above target (10h / 8h) is Present + Excellent (overtime tier)", () => {
    const day = getEffectiveAttendanceDayType(
      baseInput({
        attendanceRecord: {
          checkIn: "09:00",
          checkOut: "20:00",
          workedMinutes: 600,
          overtimeMinutes: 120,
          remarks: null,
        },
      })
    );
    expect(day.category).toBe("PRESENT");
    expect(day.ratioTier).toBe("overtime"); // 600/480 = 125%
    expect(isExcellentPresentDay(day.category, day.ratioTier, day.checkOut)).toBe(true);
  });

  it("Test 4 — absent is not Present", () => {
    const day = getEffectiveAttendanceDayType(baseInput());
    expect(day.category).toBe("ABSENT");
    expect(isPresentDay(day.category, day.ratioTier)).toBe(false);
  });

  it("Test 5 — approved leave is not Present", () => {
    const day = getEffectiveAttendanceDayType(
      baseInput({ approvedLeave: { leaveType: "CL" } })
    );
    expect(day.category).toBe("LEAVE");
    expect(isPresentDay(day.category, day.ratioTier)).toBe(false);
  });
});
