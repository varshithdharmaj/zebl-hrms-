import { describe, expect, it } from "vitest";
import {
  applyRegularizationOverlay,
  isRequestTypeConsistentWithSessions,
} from "@/lib/attendance/regularization/overlay";

describe("applyRegularizationOverlay", () => {
  it("missing_check_in on a zero-session day creates one open session", () => {
    const result = applyRegularizationOverlay([], {
      requestType: "missing_check_in",
      requestedCheckIn: "09:00",
      requestedCheckOut: null,
    });
    expect(result).toEqual([{ checkIn: "09:00", checkOut: null }]);
  });

  it("missing_check_in overrides only the earliest session's checkIn, keeps its checkOut and later sessions untouched", () => {
    const base = [
      { checkIn: "13:05", checkOut: "17:00" },
      { checkIn: "18:00", checkOut: "20:00" },
    ];
    const result = applyRegularizationOverlay(base, {
      requestType: "missing_check_in",
      requestedCheckIn: "09:00",
      requestedCheckOut: null,
    });
    expect(result).toEqual([
      { checkIn: "09:00", checkOut: "17:00" },
      { checkIn: "18:00", checkOut: "20:00" },
    ]);
  });

  it("missing_check_out overrides only the latest session's checkOut", () => {
    const base = [
      { checkIn: "09:00", checkOut: "13:00" },
      { checkIn: "14:00", checkOut: null },
    ];
    const result = applyRegularizationOverlay(base, {
      requestType: "missing_check_out",
      requestedCheckIn: null,
      requestedCheckOut: "18:30",
    });
    expect(result).toEqual([
      { checkIn: "09:00", checkOut: "13:00" },
      { checkIn: "14:00", checkOut: "18:30" },
    ]);
  });

  it("incorrect_check_out replaces a real (non-null) checkout on the last session", () => {
    const base = [{ checkIn: "09:00", checkOut: "16:00" }];
    const result = applyRegularizationOverlay(base, {
      requestType: "incorrect_check_out",
      requestedCheckIn: null,
      requestedCheckOut: "18:00",
    });
    expect(result).toEqual([{ checkIn: "09:00", checkOut: "18:00" }]);
  });

  it("missing_both replaces the entire session list with one synthetic session", () => {
    const base = [{ checkIn: "09:00", checkOut: "10:00" }];
    const result = applyRegularizationOverlay(base, {
      requestType: "missing_both",
      requestedCheckIn: "09:00",
      requestedCheckOut: "18:00",
    });
    expect(result).toEqual([{ checkIn: "09:00", checkOut: "18:00" }]);
  });

  it("attendance_missing with no requested check-in produces an empty day", () => {
    const result = applyRegularizationOverlay([{ checkIn: "09:00", checkOut: "10:00" }], {
      requestType: "attendance_missing",
      requestedCheckIn: null,
      requestedCheckOut: null,
    });
    expect(result).toEqual([]);
  });

  it("device_failure full-day override ignores existing punch-derived sessions", () => {
    const base = [
      { checkIn: "09:00", checkOut: "10:00" },
      { checkIn: "10:30", checkOut: "17:00" },
    ];
    const result = applyRegularizationOverlay(base, {
      requestType: "device_failure",
      requestedCheckIn: "09:00",
      requestedCheckOut: "18:00",
    });
    expect(result).toEqual([{ checkIn: "09:00", checkOut: "18:00" }]);
  });

  it("missing_check_out with no real sessions is a no-op (nothing to correct)", () => {
    const result = applyRegularizationOverlay([], {
      requestType: "missing_check_out",
      requestedCheckIn: null,
      requestedCheckOut: "18:00",
    });
    expect(result).toEqual([]);
  });
});

describe("isRequestTypeConsistentWithSessions", () => {
  it("missing_check_in requires zero existing sessions", () => {
    expect(isRequestTypeConsistentWithSessions("missing_check_in", [])).toBe(true);
    expect(
      isRequestTypeConsistentWithSessions("missing_check_in", [{ checkIn: "09:00", checkOut: null }])
    ).toBe(false);
  });

  it("missing_check_out requires an open (checkOut === null) last session", () => {
    expect(
      isRequestTypeConsistentWithSessions("missing_check_out", [{ checkIn: "09:00", checkOut: null }])
    ).toBe(true);
    expect(
      isRequestTypeConsistentWithSessions("missing_check_out", [
        { checkIn: "09:00", checkOut: "17:00" },
      ])
    ).toBe(false);
    expect(isRequestTypeConsistentWithSessions("missing_check_out", [])).toBe(false);
  });

  it("incorrect_check_in/out require at least one existing session", () => {
    expect(isRequestTypeConsistentWithSessions("incorrect_check_in", [])).toBe(false);
    expect(
      isRequestTypeConsistentWithSessions("incorrect_check_out", [
        { checkIn: "09:00", checkOut: "17:00" },
      ])
    ).toBe(true);
  });

  it("full-day override types are always considered consistent", () => {
    for (const type of ["missing_both", "attendance_missing", "device_failure"] as const) {
      expect(isRequestTypeConsistentWithSessions(type, [])).toBe(true);
      expect(
        isRequestTypeConsistentWithSessions(type, [{ checkIn: "09:00", checkOut: "17:00" }])
      ).toBe(true);
    }
  });
});
