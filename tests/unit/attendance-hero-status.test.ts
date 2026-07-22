import { describe, expect, it } from "vitest";
import { getHeroStatus } from "@/lib/attendance/hero-status";
import type { AttendanceDayResult } from "@/lib/attendance/day-classification";

const today = new Date(2026, 6, 20);

function baseDay(overrides: Partial<AttendanceDayResult> = {}): AttendanceDayResult {
  return {
    date: today,
    category: "ABSENT",
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

describe("getHeroStatus — required states", () => {
  it("no attendance record, past day -> Absent", () => {
    const status = getHeroStatus(baseDay({ category: "ABSENT" }), {
      isToday: false,
      expectedWorkMinutes: 480,
    });
    expect(status.label).toBe("Absent");
    expect(status.tone).toBe("danger");
  });

  it("no attendance record, today -> Not checked in yet (pending/processing)", () => {
    const status = getHeroStatus(baseDay({ category: "ABSENT" }), {
      isToday: true,
      expectedWorkMinutes: 480,
    });
    expect(status.label).toBe("Not checked in yet");
    expect(status.tone).toBe("warning");
    expect(status.actionHint).toMatch(/will update/);
  });

  it("checked in, no checkout, no worked minutes yet, today -> Checked in (live)", () => {
    const status = getHeroStatus(
      baseDay({ category: "PRESENT", checkIn: "09:05", checkOut: null, workedMinutes: 0 }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.label).toBe("Checked in");
    expect(status.isLiveInProgress).toBe(true);
    // No live elapsed-time tracking exists in this system — must not fabricate hours.
    expect(status.workedLabel).toBeNull();
    expect(status.remainingLabel).toBeNull();
  });

  it("checked in, no checkout, but a real worked-minutes figure exists -> shows remaining", () => {
    const status = getHeroStatus(
      baseDay({ category: "PRESENT", checkIn: "09:05", checkOut: null, workedMinutes: 300, ratio: 63 }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.label).toBe("Checked in");
    expect(status.workedLabel).toBe("5h");
    expect(status.remainingLabel).toBe("3h");
    expect(status.progressPercent).toBe(63);
  });

  it("worked minutes already reach/exceed target -> Target reached, not negative", () => {
    const status = getHeroStatus(
      baseDay({ category: "PRESENT", checkIn: "09:05", checkOut: null, workedMinutes: 500, ratio: 104 }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.remainingLabel).toBe("Target reached");
  });

  it("checked in AND checked out -> Work completed", () => {
    const status = getHeroStatus(
      baseDay({
        category: "PRESENT",
        checkIn: "09:05",
        checkOut: "18:10",
        workedMinutes: 480,
        ratio: 100,
      }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.label).toBe("Work completed");
    expect(status.tone).toBe("success");
    expect(status.workedLabel).toBe("8h");
    expect(status.remainingLabel).toBeNull();
  });

  it("on leave -> On leave with leave type", () => {
    const status = getHeroStatus(baseDay({ category: "LEAVE", leaveType: "EL" }), {
      isToday: true,
      expectedWorkMinutes: 480,
    });
    expect(status.label).toBe("On leave");
    expect(status.subLabel).toBe("EL leave");
    expect(status.tone).toBe("info");
  });

  it("holiday -> Holiday with holiday name", () => {
    const status = getHeroStatus(
      baseDay({ category: "HOLIDAY", holidayName: "Independence Day" }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.label).toBe("Holiday");
    expect(status.subLabel).toBe("Independence Day");
    expect(status.tone).toBe("neutral");
  });

  it("weekly off -> Weekly off", () => {
    const status = getHeroStatus(baseDay({ category: "WEEKLY_OFF" }), {
      isToday: true,
      expectedWorkMinutes: 480,
    });
    expect(status.label).toBe("Weekly off");
    expect(status.tone).toBe("neutral");
  });

  it("worked on holiday -> Worked on holiday, with times and hours", () => {
    const status = getHeroStatus(
      baseDay({
        category: "WORKED_ON_HOLIDAY",
        holidayName: "Festival",
        checkIn: "10:00",
        checkOut: "14:00",
        workedMinutes: 240,
        ratio: 50,
      }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.label).toBe("Worked on holiday");
    expect(status.subLabel).toBe("Festival");
    expect(status.tone).toBe("success");
    expect(status.workedLabel).toBe("4h");
  });

  it("worked on weekly off -> Worked on your weekly off", () => {
    const status = getHeroStatus(
      baseDay({
        category: "WORKED_ON_WEEKLY_OFF",
        checkIn: "09:00",
        checkOut: "12:00",
        workedMinutes: 180,
        ratio: 38,
      }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.label).toBe("Worked on your weekly off");
    expect(status.tone).toBe("success");
  });

  it("insufficient data on a PAST day (checked in, never checked out) -> Incomplete record, not 'Checked in'", () => {
    const status = getHeroStatus(
      baseDay({ category: "INSUFFICIENT_DATA", checkIn: "09:00", checkOut: null, workedMinutes: 0 }),
      { isToday: false, expectedWorkMinutes: 480 }
    );
    expect(status.label).toBe("Incomplete attendance record");
    expect(status.isLiveInProgress).toBe(false);
    expect(status.tone).toBe("warning");
  });

  it("late arrival is surfaced as a badge from remarks text", () => {
    const status = getHeroStatus(
      baseDay({
        category: "PRESENT",
        checkIn: "10:15",
        checkOut: "18:00",
        workedMinutes: 465,
        remark: "Late arrival noted",
      }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.badges.late).toBe(true);
  });

  it("early checkout is surfaced as a badge from remarks text", () => {
    const status = getHeroStatus(
      baseDay({
        category: "PRESENT",
        checkIn: "09:00",
        checkOut: "15:00",
        workedMinutes: 360,
        remark: "Left early for appointment",
      }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.badges.earlyCheckout).toBe(true);
  });

  it("overtime is surfaced as a badge", () => {
    const status = getHeroStatus(
      baseDay({
        category: "PRESENT",
        checkIn: "09:00",
        checkOut: "20:00",
        workedMinutes: 660,
        overtimeMinutes: 90,
        ratio: 137,
      }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.badges.overtime).toBe(true);
  });

  it("short hours is surfaced as a badge on a completed day with a low ratio", () => {
    const status = getHeroStatus(
      baseDay({
        category: "PRESENT",
        checkIn: "09:00",
        checkOut: "12:30",
        workedMinutes: 210,
        ratio: 44,
        ratioTier: "very_low",
      }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.badges.shortHours).toBe(true);
  });

  it("does not flag short hours while still checked in mid-day (not judged until the day is over)", () => {
    const status = getHeroStatus(
      baseDay({
        category: "PRESENT",
        checkIn: "09:00",
        checkOut: null,
        workedMinutes: 90,
        ratio: 19,
        ratioTier: "very_low",
      }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.isLiveInProgress).toBe(true);
    expect(status.badges.shortHours).toBe(false);
  });

  it("does not flag short hours on a completed day that met target", () => {
    const status = getHeroStatus(
      baseDay({
        category: "PRESENT",
        checkIn: "09:00",
        checkOut: "18:00",
        workedMinutes: 480,
        ratio: 100,
        ratioTier: "target",
      }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.badges.shortHours).toBe(false);
  });

  it("leave conflict is surfaced without hiding real attendance", () => {
    const status = getHeroStatus(
      baseDay({
        category: "PRESENT",
        checkIn: "09:00",
        checkOut: "18:00",
        workedMinutes: 480,
        ratio: 100,
        hasLeaveConflict: true,
      }),
      { isToday: true, expectedWorkMinutes: 480 }
    );
    expect(status.label).toBe("Work completed");
    expect(status.badges.leaveConflict).toBe(true);
  });

  it("never fabricates worked/remaining values for non-working categories", () => {
    for (const category of ["HOLIDAY", "WEEKLY_OFF", "LEAVE"] as const) {
      const status = getHeroStatus(baseDay({ category }), {
        isToday: true,
        expectedWorkMinutes: 480,
      });
      expect(status.workedLabel).toBeNull();
      expect(status.remainingLabel).toBeNull();
      expect(status.progressPercent).toBeNull();
    }
  });
});
