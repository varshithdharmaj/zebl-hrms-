import { describe, expect, it } from "vitest";
import {
  getDefaultScheduleTypeForDate,
  resolveEffectiveScheduleType,
  type WeeklySchedule,
} from "@/lib/attendance/schedule-resolver";

const defaultSchedule: WeeklySchedule = {
  mondayWorking: true,
  tuesdayWorking: true,
  wednesdayWorking: true,
  thursdayWorking: true,
  fridayWorking: true,
  saturdayWorking: false,
  sundayWorking: false,
};

// 2026-07-20 is a Monday; 2026-07-25 is a Saturday; 2026-07-26 is a Sunday.
const monday = new Date(2026, 6, 20);
const saturday = new Date(2026, 6, 25);
const sunday = new Date(2026, 6, 26);

describe("weekly schedule defaults", () => {
  it("classifies a normal weekday as working_day", () => {
    expect(getDefaultScheduleTypeForDate(monday, defaultSchedule)).toBe("working_day");
  });

  it("classifies Saturday as weekly_off by default", () => {
    expect(getDefaultScheduleTypeForDate(saturday, defaultSchedule)).toBe("weekly_off");
  });

  it("classifies Sunday as weekly_off by default", () => {
    expect(getDefaultScheduleTypeForDate(sunday, defaultSchedule)).toBe("weekly_off");
  });

  it("respects a configured working Saturday", () => {
    const sixDaySchedule: WeeklySchedule = { ...defaultSchedule, saturdayWorking: true };
    expect(getDefaultScheduleTypeForDate(saturday, sixDaySchedule)).toBe("working_day");
  });
});

describe("date override precedence", () => {
  it("a working_day override wins over a default weekly_off Saturday", () => {
    expect(resolveEffectiveScheduleType(saturday, defaultSchedule, "working_day")).toBe(
      "working_day"
    );
  });

  it("a weekly_off override wins over a default working Wednesday", () => {
    const wednesday = new Date(2026, 6, 22);
    expect(resolveEffectiveScheduleType(wednesday, defaultSchedule, "weekly_off")).toBe(
      "weekly_off"
    );
  });

  it("falls back to the default schedule when no override exists", () => {
    expect(resolveEffectiveScheduleType(monday, defaultSchedule, null)).toBe("working_day");
    expect(resolveEffectiveScheduleType(saturday, defaultSchedule, null)).toBe("weekly_off");
  });
});
