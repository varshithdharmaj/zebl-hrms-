import { describe, expect, it } from "vitest";
import { JobOpeningStatus } from "@/generated/prisma/enums";
import { formatDurationShort, formatJobOpeningAge } from "@/lib/recruitment/job/format-age";

describe("formatDurationShort", () => {
  it("formats days under a month", () => {
    expect(formatDurationShort(4 * 86_400_000)).toBe("4d");
    expect(formatDurationShort(18 * 86_400_000)).toBe("18d");
  });

  it("formats months under a year", () => {
    expect(formatDurationShort(60 * 86_400_000)).toBe("2mo");
  });

  it("formats years", () => {
    expect(formatDurationShort(370 * 86_400_000)).toBe("1y");
  });

  it("never goes negative", () => {
    expect(formatDurationShort(-1000)).toBe("Today");
  });

  it("handles same-day and exactly-one-day boundaries", () => {
    expect(formatDurationShort(0)).toBe("Today");
    expect(formatDurationShort(23 * 3_600_000)).toBe("Today"); // 23h, not yet 1 full day
    expect(formatDurationShort(1 * 86_400_000)).toBe("1d");
  });

  it("crosses the day→month boundary at 30 days", () => {
    expect(formatDurationShort(29 * 86_400_000)).toBe("29d");
    expect(formatDurationShort(30 * 86_400_000)).toBe("1mo");
  });

  it("never regresses to '0y' near the 360-364 day range (months/years must agree)", () => {
    // Regression: deriving years from days/365 independently of months/30
    // produced "0y" for a job that's clearly ~12 months old.
    expect(formatDurationShort(359 * 86_400_000)).toBe("11mo");
    expect(formatDurationShort(360 * 86_400_000)).toBe("1y");
    expect(formatDurationShort(364 * 86_400_000)).toBe("1y");
    expect(formatDurationShort(365 * 86_400_000)).toBe("1y");
  });

  it("formats multi-year durations", () => {
    expect(formatDurationShort(800 * 86_400_000)).toBe("2y");
  });
});

describe("formatJobOpeningAge", () => {
  it("shows time since creation for an open job", () => {
    const createdAt = new Date(Date.now() - 4 * 86_400_000);
    const age = formatJobOpeningAge({ createdAt, status: JobOpeningStatus.open, closedAt: null });
    expect(age).toBe("4d");
  });

  it("shows 'Closed after Xd' once a job has actually closed", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const closedAt = new Date("2026-01-15T00:00:00Z"); // 14 days later
    const age = formatJobOpeningAge({ createdAt, status: JobOpeningStatus.closed, closedAt });
    expect(age).toBe("Closed after 14d");
  });

  it("falls back to age-since-creation if a closed job has no closedAt", () => {
    const createdAt = new Date(Date.now() - 10 * 86_400_000);
    const age = formatJobOpeningAge({ createdAt, status: JobOpeningStatus.closed, closedAt: null });
    expect(age).toBe("10d");
  });

  it("shows plain age (not 'Closed after') for non-closed statuses, e.g. draft", () => {
    const createdAt = new Date(Date.now() - 5 * 86_400_000);
    const age = formatJobOpeningAge({ createdAt, status: JobOpeningStatus.draft, closedAt: null });
    expect(age).toBe("5d");
  });

  it("clamps a future createdAt (clock skew) to 'Today' instead of a negative age", () => {
    const createdAt = new Date(Date.now() + 86_400_000);
    const age = formatJobOpeningAge({ createdAt, status: JobOpeningStatus.open, closedAt: null });
    expect(age).toBe("Today");
  });
});
