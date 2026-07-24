import { describe, expect, it } from "vitest";
import {
  mapAttendancePeriods,
  shouldShowAttendancePeriods,
  toAttendancePeriodDisplay,
  type AttendancePeriodSession,
} from "@/lib/attendance/attendance-periods-display";
import { minutesToHours } from "@/lib/utils";

function session(
  overrides: Partial<AttendancePeriodSession> & Pick<AttendancePeriodSession, "id" | "checkIn">
): AttendancePeriodSession {
  const checkOut = overrides.checkOut ?? null;
  return {
    id: overrides.id,
    checkIn: overrides.checkIn,
    checkOut,
    workedMinutes: overrides.workedMinutes ?? 0,
    isOpen: overrides.isOpen ?? checkOut == null,
  };
}

describe("shouldShowAttendancePeriods", () => {
  it("is false for no attendance / empty sessions", () => {
    expect(shouldShowAttendancePeriods(undefined)).toBe(false);
    expect(shouldShowAttendancePeriods([])).toBe(false);
  });

  it("is false for a single period (preserve existing summary UI)", () => {
    expect(
      shouldShowAttendancePeriods([
        session({ id: 1, checkIn: "09:00", checkOut: "18:00", workedMinutes: 480 }),
      ])
    ).toBe(false);
  });

  it("is false for a legacy synthetic single session", () => {
    expect(
      shouldShowAttendancePeriods([
        session({ id: 0, checkIn: "09:04", checkOut: "18:25", workedMinutes: 561 }),
      ])
    ).toBe(false);
  });

  it("is true for multiple periods", () => {
    expect(
      shouldShowAttendancePeriods([
        session({ id: 1, checkIn: "09:00", checkOut: "12:00", workedMinutes: 180 }),
        session({ id: 2, checkIn: "13:00", checkOut: "18:00", workedMinutes: 300 }),
      ])
    ).toBe(true);
  });
});

describe("toAttendancePeriodDisplay", () => {
  it("formats a completed period with backend workedMinutes", () => {
    const display = toAttendancePeriodDisplay(
      session({ id: 1, checkIn: "09:00", checkOut: "12:00", workedMinutes: 180 })
    );
    expect(display.rangeLabel).toBe("09:00 AM → 12:00 PM");
    expect(display.durationLabel).toBe("3h");
    expect(display.isOpen).toBe(false);
  });

  it("formats afternoon period as 01:00 PM → 06:00 PM", () => {
    const display = toAttendancePeriodDisplay(
      session({ id: 2, checkIn: "13:00", checkOut: "18:00", workedMinutes: 300 })
    );
    expect(display.rangeLabel).toBe("01:00 PM → 06:00 PM");
    expect(display.durationLabel).toBe("5h");
  });

  it("shows In Progress for an open session", () => {
    const display = toAttendancePeriodDisplay(
      session({ id: 3, checkIn: "13:00", checkOut: null, workedMinutes: 0, isOpen: true })
    );
    expect(display.rangeLabel).toBe("01:00 PM → In Progress");
    expect(display.durationLabel).toBeNull();
    expect(display.isOpen).toBe(true);
  });
});

describe("mapAttendancePeriods — Kapil multi-session verification shape", () => {
  it("maps both periods and keeps daily totals as backend values", () => {
    const sessions = [
      session({ id: 1, checkIn: "09:00", checkOut: "12:00", workedMinutes: 180 }),
      session({ id: 2, checkIn: "13:00", checkOut: "18:00", workedMinutes: 300 }),
    ];
    const periods = mapAttendancePeriods(sessions);
    expect(periods).toHaveLength(2);
    expect(periods[0].rangeLabel).toBe("09:00 AM → 12:00 PM");
    expect(periods[1].rangeLabel).toBe("01:00 PM → 06:00 PM");

    const totalWorkedMinutes = 480;
    const overtimeMinutes = 0;
    expect(minutesToHours(totalWorkedMinutes)).toBe("8h");
    expect(minutesToHours(overtimeMinutes)).toBe("0m");
    expect(shouldShowAttendancePeriods(sessions)).toBe(true);
  });

  it("does not invent periods when there is no attendance", () => {
    expect(mapAttendancePeriods([])).toEqual([]);
    expect(shouldShowAttendancePeriods([])).toBe(false);
  });

  it("renders exactly the sessions passed for the selected date (no cross-date merge)", () => {
    const selectedDateSessions = [
      session({ id: 10, checkIn: "09:00", checkOut: "12:00", workedMinutes: 180 }),
      session({ id: 11, checkIn: "13:00", checkOut: "18:00", workedMinutes: 300 }),
    ];
    const mapped = mapAttendancePeriods(selectedDateSessions);
    expect(mapped.map((p) => p.id)).toEqual([10, 11]);
    expect(mapped).toHaveLength(selectedDateSessions.length);
  });
});
