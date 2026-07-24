import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  findHeatmapDayStatus,
  getAttendanceDayStatus,
  type AttendanceDayCalendarContext,
} from "@/lib/attendance/day-status";
import type { AttendanceDayResult } from "@/lib/attendance/day-classification";
import { startOfDay } from "@/lib/utils";

vi.mock("@/lib/leave/leave-calendar", () => ({
  getHolidaysForRange: vi.fn(),
  getApprovedLeaveForEmployeeRange: vi.fn(),
}));

vi.mock("@/lib/attendance/attendance-settings", () => ({
  getAttendanceSettings: vi.fn(),
  getDateOverridesForRange: vi.fn(),
}));

import { getHolidaysForRange, getApprovedLeaveForEmployeeRange } from "@/lib/leave/leave-calendar";
import { getAttendanceSettings, getDateOverridesForRange } from "@/lib/attendance/attendance-settings";

function makeDay(date: Date, category: AttendanceDayResult["category"]): AttendanceDayResult {
  return {
    date,
    category,
    scheduleType: "working_day",
    workedMinutes: category === "PRESENT" ? 480 : 0,
    overtimeMinutes: 0,
    ratio: category === "PRESENT" ? 100 : null,
    ratioTier: category === "PRESENT" ? "target" : null,
    checkIn: category === "PRESENT" ? "09:00" : null,
    checkOut: category === "PRESENT" ? "18:00" : null,
    remark: null,
    holidayName: category === "HOLIDAY" ? "Test Holiday" : null,
    leaveType: category === "LEAVE" ? "CL" : null,
    hasLeaveConflict: false,
  };
}

const settings = {
  mondayWorking: true,
  tuesdayWorking: true,
  wednesdayWorking: true,
  thursdayWorking: true,
  fridayWorking: true,
  saturdayWorking: false,
  sundayWorking: false,
  expectedWorkMinutes: 480,
};

describe("findHeatmapDayStatus", () => {
  it("returns null when heatmap is missing", () => {
    expect(findHeatmapDayStatus(null, new Date("2026-07-01"))).toBeNull();
    expect(findHeatmapDayStatus(undefined, new Date("2026-07-01"))).toBeNull();
  });

  it("returns the matching classified day and expected minutes", () => {
    const target = startOfDay(new Date("2026-07-15T00:00:00"));
    const heatmap = {
      expectedWorkMinutes: 480,
      days: [
        makeDay(startOfDay(new Date("2026-07-14T00:00:00")), "ABSENT"),
        makeDay(target, "PRESENT"),
      ],
    };
    const result = findHeatmapDayStatus(heatmap, new Date("2026-07-15T12:00:00"));
    expect(result?.day.category).toBe("PRESENT");
    expect(result?.expectedWorkMinutes).toBe(480);
  });

  it("returns null when the selected date is outside the heatmap span", () => {
    const heatmap = {
      expectedWorkMinutes: 480,
      days: [makeDay(startOfDay(new Date("2026-07-01T00:00:00")), "WEEKLY_OFF")],
    };
    expect(findHeatmapDayStatus(heatmap, new Date("2025-12-31"))).toBeNull();
  });
});

describe("getAttendanceDayStatus calendar reuse", () => {
  beforeEach(() => {
    vi.mocked(getHolidaysForRange).mockReset();
    vi.mocked(getApprovedLeaveForEmployeeRange).mockReset();
    vi.mocked(getAttendanceSettings).mockReset();
    vi.mocked(getDateOverridesForRange).mockReset();
  });

  it("skips calendar queries when context is provided", async () => {
    const day = startOfDay(new Date("2026-07-15T00:00:00"));
    const calendar: AttendanceDayCalendarContext = {
      settings,
      holidays: [{ holidayDate: day, name: "Festival" }],
      approvedLeave: [],
      overrides: [],
    };

    const result = await getAttendanceDayStatus({
      employeeId: 1,
      date: day,
      attendanceRecord: null,
      calendar,
    });

    expect(getHolidaysForRange).not.toHaveBeenCalled();
    expect(getApprovedLeaveForEmployeeRange).not.toHaveBeenCalled();
    expect(getAttendanceSettings).not.toHaveBeenCalled();
    expect(getDateOverridesForRange).not.toHaveBeenCalled();
    expect(result.day.category).toBe("HOLIDAY");
    expect(result.expectedWorkMinutes).toBe(480);
  });

  it("fetches calendar helpers when context is omitted", async () => {
    const day = startOfDay(new Date("2026-07-15T00:00:00"));
    vi.mocked(getHolidaysForRange).mockResolvedValue([]);
    vi.mocked(getApprovedLeaveForEmployeeRange).mockResolvedValue([]);
    vi.mocked(getAttendanceSettings).mockResolvedValue(settings);
    vi.mocked(getDateOverridesForRange).mockResolvedValue([]);

    await getAttendanceDayStatus({
      employeeId: 42,
      date: day,
      attendanceRecord: {
        checkIn: "09:00",
        checkOut: "18:00",
        workedMinutes: 480,
        overtimeMinutes: 0,
        remarks: null,
      },
    });

    expect(getHolidaysForRange).toHaveBeenCalledTimes(1);
    expect(getApprovedLeaveForEmployeeRange).toHaveBeenCalledWith(42, expect.any(Date), expect.any(Date));
    expect(getAttendanceSettings).toHaveBeenCalledTimes(1);
    expect(getDateOverridesForRange).toHaveBeenCalledTimes(1);
  });

  it("classifies leave days from reused approved-leave context", async () => {
    const day = startOfDay(new Date("2026-07-16T00:00:00"));
    const result = await getAttendanceDayStatus({
      employeeId: 1,
      date: day,
      attendanceRecord: null,
      calendar: {
        settings,
        holidays: [],
        approvedLeave: [
          {
            leaveType: "CL",
            startDate: day,
            endDate: day,
          },
        ],
        overrides: [],
      },
    });
    expect(result.day.category).toBe("LEAVE");
    expect(result.day.leaveType).toBe("CL");
  });
});
