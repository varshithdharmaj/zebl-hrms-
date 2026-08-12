import { describe, expect, it } from "vitest";
import {
  buildInterviewCalendarHref,
  calendarMonthRange,
  resolveCalendarMonthYear,
} from "@/lib/recruitment/interview/calendar-range";

describe("interview calendar range", () => {
  it("defaults to the current local month when params are missing", () => {
    const now = new Date(2026, 7, 12);
    expect(resolveCalendarMonthYear(undefined, undefined, now)).toEqual({
      month: 8,
      year: 2026,
    });
  });

  it("parses month and year from search params", () => {
    expect(resolveCalendarMonthYear("3", "2025")).toEqual({ month: 3, year: 2025 });
  });

  it("falls back for invalid month/year", () => {
    const now = new Date(2026, 0, 5);
    expect(resolveCalendarMonthYear("13", "abc", now)).toEqual({ month: 1, year: 2026 });
  });

  it("returns inclusive local month boundaries", () => {
    const { scheduledStartFrom, scheduledStartTo } = calendarMonthRange(2026, 2);
    expect(scheduledStartFrom).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0));
    expect(scheduledStartTo).toEqual(new Date(2026, 2, 0, 23, 59, 59, 999));
  });

  it("builds calendar href with month and year", () => {
    expect(
      buildInterviewCalendarHref({ view: "upcoming", layout: "calendar", month: 4, year: 2026 })
    ).toBe("/admin/recruitment/interviews?view=upcoming&layout=calendar&month=4&year=2026");
  });
});
