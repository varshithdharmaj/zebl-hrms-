import { describe, expect, it } from "vitest";
import {
  formatClockTime,
  openSessionElapsedMinutes,
  parseTimeToMinutes,
  sessionDurationMinutes,
  totalWorkedMinutesFromSessions,
} from "@/lib/attendance/session-duration";

describe("sessionDurationMinutes", () => {
  it("calculates same-day session duration", () => {
    expect(sessionDurationMinutes("09:00", "12:30")).toBe(210);
    expect(sessionDurationMinutes("13:30", "17:30")).toBe(240);
  });

  it("supports overnight wrap when checkout is before checkin", () => {
    expect(sessionDurationMinutes("22:00", "06:00")).toBe(480);
  });

  it("returns 0 for open sessions", () => {
    expect(sessionDurationMinutes("09:00", null)).toBe(0);
  });
});

describe("totalWorkedMinutesFromSessions", () => {
  it("sums multiple completed sessions", () => {
    const total = totalWorkedMinutesFromSessions([
      { checkIn: "09:00", checkOut: "12:30", workedMinutes: 210 },
      { checkIn: "13:30", checkOut: "17:30", workedMinutes: 240 },
    ]);
    expect(total).toBe(450);
  });

  it("includes open session elapsed time", () => {
    const asOf = new Date(2026, 6, 23, 15, 45, 0); // 15:45 local
    const total = totalWorkedMinutesFromSessions(
      [
        { checkIn: "09:00", checkOut: "12:30", workedMinutes: 210 },
        { checkIn: "13:30", checkOut: null, workedMinutes: 0 },
      ],
      { includeOpenElapsed: true, asOf }
    );
    // 210 + (15:45 - 13:30 = 135) = 345
    expect(total).toBe(345);
  });

  it("can exclude open elapsed", () => {
    const total = totalWorkedMinutesFromSessions(
      [
        { checkIn: "09:00", checkOut: "12:00", workedMinutes: 180 },
        { checkIn: "13:00", checkOut: null, workedMinutes: 0 },
      ],
      { includeOpenElapsed: false }
    );
    expect(total).toBe(180);
  });
});

describe("parseTimeToMinutes / formatClockTime", () => {
  it("parses HH:MM", () => {
    expect(parseTimeToMinutes("09:05")).toBe(545);
    expect(parseTimeToMinutes("18:00")).toBe(1080);
  });

  it("formats AM/PM clock labels", () => {
    expect(formatClockTime("09:00")).toBe("09:00 AM");
    expect(formatClockTime("12:30")).toBe("12:30 PM");
    expect(formatClockTime("13:30")).toBe("01:30 PM");
    expect(formatClockTime("00:15")).toBe("12:15 AM");
  });
});

describe("openSessionElapsedMinutes", () => {
  it("computes elapsed since check-in", () => {
    const asOf = new Date(2026, 6, 23, 11, 0, 0);
    expect(openSessionElapsedMinutes("09:00", asOf)).toBe(120);
  });
});
