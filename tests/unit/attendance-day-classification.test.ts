import { describe, expect, it } from "vitest";
import {
  getEffectiveAttendanceDayType,
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

// 2026-07-20 = Monday (working by default), 2026-07-25 = Saturday (off by default).
const workingDay = new Date(2026, 6, 20);
const weeklyOffDay = new Date(2026, 6, 25);

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

function present(workedMinutes: number, overtimeMinutes = 0) {
  return {
    checkIn: "09:00",
    checkOut: "18:00",
    workedMinutes,
    overtimeMinutes,
    remarks: null,
  };
}

describe("getEffectiveAttendanceDayType — no attendance exists", () => {
  it("Rule 5: working day, no attendance -> ABSENT", () => {
    const result = getEffectiveAttendanceDayType(baseInput({ date: workingDay }));
    expect(result.category).toBe("ABSENT");
  });

  it("Rule 4: weekly off, no attendance -> WEEKLY_OFF (never ABSENT)", () => {
    const result = getEffectiveAttendanceDayType(baseInput({ date: weeklyOffDay }));
    expect(result.category).toBe("WEEKLY_OFF");
  });

  it("Rule 6: holiday, no attendance -> HOLIDAY", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({ date: workingDay, holiday: { name: "Founders Day" } })
    );
    expect(result.category).toBe("HOLIDAY");
    expect(result.holidayName).toBe("Founders Day");
  });

  it("approved leave, no attendance -> LEAVE", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({ date: workingDay, approvedLeave: { leaveType: "EL" } })
    );
    expect(result.category).toBe("LEAVE");
    expect(result.leaveType).toBe("EL");
  });

  it("working_day override with no attendance -> ABSENT even on a normally-off Saturday", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({ date: weeklyOffDay, dateOverride: "working_day" })
    );
    expect(result.category).toBe("ABSENT");
  });

  it("weekly_off override with no attendance -> WEEKLY_OFF even on a normally-working Wednesday", () => {
    const wednesday = new Date(2026, 6, 22);
    const result = getEffectiveAttendanceDayType(
      baseInput({ date: wednesday, dateOverride: "weekly_off" })
    );
    expect(result.category).toBe("WEEKLY_OFF");
  });

  it("a working_day override on a holiday with no attendance -> ABSENT (override precedes holiday)", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({
        date: workingDay,
        dateOverride: "working_day",
        holiday: { name: "Regional holiday" },
      })
    );
    expect(result.category).toBe("ABSENT");
  });
});

describe("getEffectiveAttendanceDayType — attendance exists (Rules 1 & 2: never hidden)", () => {
  it("Rule 1: attendance on a weekly off -> WORKED_ON_WEEKLY_OFF, never bare WEEKLY_OFF", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({ date: weeklyOffDay, attendanceRecord: present(480) })
    );
    expect(result.category).toBe("WORKED_ON_WEEKLY_OFF");
  });

  it("Rule 2: attendance on a holiday -> WORKED_ON_HOLIDAY, never bare HOLIDAY", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({
        date: workingDay,
        holiday: { name: "Festival" },
        attendanceRecord: present(480),
      })
    );
    expect(result.category).toBe("WORKED_ON_HOLIDAY");
  });

  it("a working_day override on a normally-off Saturday with attendance -> PRESENT, not WORKED_ON_WEEKLY_OFF", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({
        date: weeklyOffDay,
        dateOverride: "working_day",
        attendanceRecord: present(480),
      })
    );
    expect(result.category).toBe("PRESENT");
  });

  it("normal working day with attendance -> PRESENT", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({ date: workingDay, attendanceRecord: present(480) })
    );
    expect(result.category).toBe("PRESENT");
  });
});

describe("getEffectiveAttendanceDayType — Rule 3: leave/attendance conflict", () => {
  it("approved leave + real attendance -> PRESENT (not hidden) with hasLeaveConflict", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({
        date: workingDay,
        approvedLeave: { leaveType: "CL" },
        attendanceRecord: present(480),
      })
    );
    expect(result.category).toBe("PRESENT");
    expect(result.hasLeaveConflict).toBe(true);
  });

  it("approved leave with no attendance has no conflict flag", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({ date: workingDay, approvedLeave: { leaveType: "CL" } })
    );
    expect(result.category).toBe("LEAVE");
    expect(result.hasLeaveConflict).toBe(false);
  });
});

describe("getEffectiveAttendanceDayType — data quality", () => {
  it("missing check-in -> no valid attendance -> ABSENT on a working day", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({
        date: workingDay,
        attendanceRecord: { checkIn: null, checkOut: null, workedMinutes: 0, overtimeMinutes: 0, remarks: null },
      })
    );
    expect(result.category).toBe("ABSENT");
  });

  it("check-in present, check-out missing, zero worked minutes -> INSUFFICIENT_DATA", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({
        date: workingDay,
        attendanceRecord: { checkIn: "09:00", checkOut: null, workedMinutes: 0, overtimeMinutes: 0, remarks: null },
      })
    );
    expect(result.category).toBe("INSUFFICIENT_DATA");
  });

  it("check-in and check-out present with zero worked minutes still has enough data -> PRESENT", () => {
    const result = getEffectiveAttendanceDayType(
      baseInput({
        date: workingDay,
        attendanceRecord: { checkIn: "09:00", checkOut: "09:00", workedMinutes: 0, overtimeMinutes: 0, remarks: null },
      })
    );
    expect(result.category).toBe("PRESENT");
    expect(result.ratioTier).toBe("very_low");
  });
});

describe("getEffectiveAttendanceDayType — working-hour ratio tiers (expectedWorkMinutes = 480)", () => {
  const cases: [number, string][] = [
    [100, "very_low"],
    [300, "partial"],
    [420, "near_target"],
    [480, "target"],
    [700, "overtime"],
  ];

  for (const [minutes, tier] of cases) {
    it(`${minutes} worked minutes -> ${tier}`, () => {
      const result = getEffectiveAttendanceDayType(
        baseInput({ date: workingDay, attendanceRecord: present(minutes) })
      );
      expect(result.ratioTier).toBe(tier);
    });
  }
});
