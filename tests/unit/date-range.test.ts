import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyDateRangeToSearchParams,
  clampIsoToToday,
  defaultDateRangeValue,
  formatDateRangeShort,
  getPresetRange,
  isValidIsoDate,
  matchPreset,
  parseDateRangeQuery,
  toExclusiveUpperBound,
  todayIso,
} from "@/lib/date-range";
import { parseISODate, toISODate } from "@/lib/utils";

describe("getPresetRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 23, 15, 30, 0)); // 23 Jul 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves today", () => {
    expect(getPresetRange("today")).toEqual({ from: "2026-07-23", to: "2026-07-23" });
  });

  it("resolves yesterday", () => {
    expect(getPresetRange("yesterday")).toEqual({ from: "2026-07-22", to: "2026-07-22" });
  });

  it("resolves last 7 days inclusive of today", () => {
    expect(getPresetRange("last-7-days")).toEqual({ from: "2026-07-17", to: "2026-07-23" });
  });

  it("resolves last 30 days inclusive of today", () => {
    expect(getPresetRange("last-30-days")).toEqual({ from: "2026-06-24", to: "2026-07-23" });
  });

  it("resolves this month through today", () => {
    expect(getPresetRange("this-month")).toEqual({ from: "2026-07-01", to: "2026-07-23" });
  });

  it("resolves last month across the full previous month", () => {
    expect(getPresetRange("last-month")).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });

  it("handles month boundary for last-7-days", () => {
    vi.setSystemTime(new Date(2026, 6, 3, 10, 0, 0));
    expect(getPresetRange("last-7-days")).toEqual({ from: "2026-06-27", to: "2026-07-03" });
  });

  it("handles year boundary for last-month", () => {
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0));
    expect(getPresetRange("last-month")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("handles leap-year February for last-month", () => {
    vi.setSystemTime(new Date(2024, 2, 10, 10, 0, 0)); // Mar 10, 2024
    expect(getPresetRange("last-month")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
});

describe("parseDateRangeQuery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 23, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to this month when params are missing", () => {
    const parsed = parseDateRangeQuery({});
    expect(parsed).toMatchObject({
      from: "2026-07-01",
      to: "2026-07-23",
      preset: "this-month",
    });
    expect(toISODate(parsed.toExclusive)).toBe("2026-07-24");
  });

  it("accepts valid from/to ranges", () => {
    const parsed = parseDateRangeQuery({ from: "2026-07-01", to: "2026-07-16" });
    expect(parsed.from).toBe("2026-07-01");
    expect(parsed.to).toBe("2026-07-16");
    expect(parsed.preset).toBe("custom");
  });

  it("accepts legacy start/end aliases", () => {
    const parsed = parseDateRangeQuery({ start: "2026-07-10", end: "2026-07-12" });
    expect(parsed.from).toBe("2026-07-10");
    expect(parsed.to).toBe("2026-07-12");
  });

  it("prefers from/to over start/end", () => {
    const parsed = parseDateRangeQuery({
      from: "2026-07-05",
      to: "2026-07-06",
      start: "2026-01-01",
      end: "2026-01-31",
    });
    expect(parsed.from).toBe("2026-07-05");
    expect(parsed.to).toBe("2026-07-06");
  });

  it("swaps reversed ranges", () => {
    const parsed = parseDateRangeQuery({ from: "2026-07-20", to: "2026-07-05" });
    expect(parsed.from).toBe("2026-07-05");
    expect(parsed.to).toBe("2026-07-20");
  });

  it("clamps future dates to today", () => {
    const parsed = parseDateRangeQuery({ from: "2026-07-01", to: "2026-08-01" });
    expect(parsed.to).toBe("2026-07-23");
  });

  it("falls back on invalid dates", () => {
    const parsed = parseDateRangeQuery({ from: "not-a-date", to: "2026-13-40" });
    expect(parsed.from).toBe("2026-07-01");
    expect(parsed.to).toBe("2026-07-23");
    expect(parsed.preset).toBe("this-month");
  });

  it("recomputes bounds for a known preset", () => {
    const parsed = parseDateRangeQuery({
      preset: "last-7-days",
      from: "2000-01-01",
      to: "2000-01-02",
    });
    expect(parsed.from).toBe("2026-07-17");
    expect(parsed.to).toBe("2026-07-23");
    expect(parsed.preset).toBe("last-7-days");
  });

  it("treats malformed presets as custom when dates are valid", () => {
    const parsed = parseDateRangeQuery({
      preset: "nope",
      from: "2026-07-01",
      to: "2026-07-02",
    });
    expect(parsed.preset).toBe("custom");
  });

  it("matches this-month when dates equal the preset", () => {
    expect(matchPreset("2026-07-01", "2026-07-23")).toBe("this-month");
  });
});

describe("toExclusiveUpperBound / helpers", () => {
  it("returns next local midnight for an inclusive end date", () => {
    const exclusive = toExclusiveUpperBound("2026-07-23");
    expect(toISODate(exclusive)).toBe("2026-07-24");
    expect(exclusive.getHours()).toBe(0);
  });

  it("validates ISO dates strictly", () => {
    expect(isValidIsoDate("2026-07-23")).toBe(true);
    expect(isValidIsoDate("2026-7-23")).toBe(false);
    expect(isValidIsoDate("2026-02-31")).toBe(false);
  });

  it("clamps ISO strings to today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 23, 12, 0, 0));
    expect(clampIsoToToday("2026-08-01")).toBe("2026-07-23");
    expect(clampIsoToToday("2026-07-01")).toBe("2026-07-01");
    expect(todayIso()).toBe("2026-07-23");
    vi.useRealTimers();
  });

  it("formats short labels without UTC shift", () => {
    expect(formatDateRangeShort("2026-07-01", "2026-07-23")).toBe("Jul 01 – Jul 23");
    expect(formatDateRangeShort("2026-07-09", "2026-07-09")).toBe("Jul 09");
  });

  it("serializes range params and clears page", () => {
    const params = new URLSearchParams("page=3&foo=1");
    const next = applyDateRangeToSearchParams(params, {
      from: "2026-07-01",
      to: "2026-07-23",
      preset: "this-month",
    });
    expect(next.get("start")).toBe("2026-07-01");
    expect(next.get("end")).toBe("2026-07-23");
    expect(next.get("preset")).toBe("this-month");
    expect(next.get("page")).toBeNull();
    expect(next.get("foo")).toBe("1");
  });

  it("writes from/to when configured", () => {
    const next = applyDateRangeToSearchParams(
      new URLSearchParams("start=2026-01-01&end=2026-01-31"),
      { from: "2026-07-01", to: "2026-07-23", preset: "this-month" },
      { fromParam: "from", toParam: "to", legacyFromParam: "start", legacyToParam: "end" }
    );
    expect(next.get("from")).toBe("2026-07-01");
    expect(next.get("to")).toBe("2026-07-23");
    expect(next.get("start")).toBeNull();
    expect(next.get("end")).toBeNull();
  });

  it("round-trips defaultDateRangeValue through parseISODate", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 23, 12, 0, 0));
    const value = defaultDateRangeValue();
    expect(parseISODate(value.from)?.getDate()).toBe(1);
    expect(parseISODate(value.to)?.getDate()).toBe(23);
    vi.useRealTimers();
  });
});
