import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  toISODate,
  parseISODate,
  startOfDay,
  defaultDateRange,
  parseDateRange,
} from "@/lib/utils";

describe("toISODate", () => {
  it("returns the local calendar date, not the UTC-shifted one", () => {
    // Regression: the previous implementation used `.toISOString().split("T")[0]`,
    // which rolls back a day for any positive-UTC-offset timezone (e.g. IST) because
    // local midnight is still the previous calendar day in UTC.
    expect(toISODate(new Date(2026, 6, 22))).toBe("2026-07-22");
  });

  it("ignores time-of-day once zeroed by startOfDay", () => {
    const withTime = new Date(2026, 6, 22, 23, 45, 0);
    expect(toISODate(startOfDay(withTime))).toBe("2026-07-22");
  });

  it("handles a year boundary", () => {
    expect(toISODate(new Date(2025, 11, 31))).toBe("2025-12-31");
  });

  it("round-trips through parseISODate", () => {
    const original = startOfDay(new Date(2026, 3, 5));
    const roundTripped = parseISODate(toISODate(original));
    expect(roundTripped?.getTime()).toBe(original.getTime());
  });
});

describe("defaultDateRange / parseDateRange with a fixed clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves 'this month through today' to the correct calendar dates", () => {
    // This is the exact scenario that was silently off by one day: month-start and
    // today's date both need to reflect the LOCAL calendar day the clock is set to.
    expect(defaultDateRange()).toEqual({ start: "2026-07-01", end: "2026-07-22" });
  });

  it("swaps an inverted range and still reports the corrected ISO bounds", () => {
    const { startIso, endIso } = parseDateRange("2026-07-20", "2026-07-05");
    expect(startIso).toBe("2026-07-05");
    expect(endIso).toBe("2026-07-20");
  });

  it("treats a same-day range as a single day", () => {
    const { startIso, endIso } = parseDateRange("2026-07-10", "2026-07-10");
    expect(startIso).toBe("2026-07-10");
    expect(endIso).toBe("2026-07-10");
  });
});
