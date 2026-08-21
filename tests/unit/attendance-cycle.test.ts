import { describe, expect, it } from "vitest";
import { getAttendanceCycleWindow } from "@/lib/attendance/attendance-cycle";
import { toISODate } from "@/lib/utils";

function window(y: number, m: number, d: number) {
  const w = getAttendanceCycleWindow(new Date(y, m - 1, d));
  return { start: toISODate(w.startDate), end: toISODate(w.endDate), count: w.dates.length };
}

describe("getAttendanceCycleWindow", () => {
  it("before the 25th uses previous month's 25th through this month's 25th", () => {
    expect(window(2026, 8, 20)).toMatchObject({ start: "2026-07-25", end: "2026-08-25" });
  });

  it("on the 25th starts a new cycle through next month's 25th", () => {
    expect(window(2026, 8, 25)).toMatchObject({ start: "2026-08-25", end: "2026-09-25" });
  });

  it("after the 25th stays in the cycle that started this month", () => {
    expect(window(2026, 8, 26)).toMatchObject({ start: "2026-08-25", end: "2026-09-25" });
  });

  it("crosses a December → January year boundary", () => {
    expect(window(2026, 12, 26)).toMatchObject({ start: "2026-12-25", end: "2027-01-25" });
  });

  it("resolves January dates before the 25th back into December", () => {
    expect(window(2027, 1, 20)).toMatchObject({ start: "2026-12-25", end: "2027-01-25" });
  });

  it("handles a leap-year February", () => {
    expect(window(2028, 2, 20)).toMatchObject({ start: "2028-01-25", end: "2028-02-25" });
  });

  it("always includes today inside [startDate, endDate]", () => {
    const today = new Date(2026, 7, 20);
    const w = getAttendanceCycleWindow(today);
    expect(today >= w.startDate && today <= w.endDate).toBe(true);
  });

  it("dates array is inclusive of both boundaries with no gaps or duplicates", () => {
    const w = window(2026, 8, 20);
    // Jul has 31 days: 25..31 (7) + Aug 1..25 (25) = 32 inclusive days.
    expect(w.count).toBe(32);
  });
});
