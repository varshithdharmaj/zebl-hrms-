import {
  isBelowTargetPresentDay,
  isExcellentPresentDay,
  isPresentDay,
  type AttendanceDayResult,
} from "@/lib/attendance/day-classification";

export type HeatmapMonthStats = {
  monthKey: string;
  year: number;
  monthIndex: number;
  /** e.g. "Jul 2026" */
  label: string;
  /**
   * Canonical Present: any attended/worked day.
   * Equals excellentDays + below-target worked days; matches KPI presentDays.
   */
  presentDays: number;
  /** Worked days at target or overtime (Excellent swatch). */
  excellentDays: number;
  /** Worked days below expected hours (soft-green swatch). */
  belowTargetDays: number;
  absentDays: number;
  leaveDays: number;
  insufficientDays: number;
  /**
   * Attended (present) / (present + absent + insufficient) × 100.
   * Null when the denominator is 0 (month is only leave/holiday/weekly-off).
   */
  attendancePercent: number | null;
  /** Mean worked minutes across attended days; null when none. */
  averageWorkedMinutes: number | null;
};

export type MonthWeekRange = {
  monthKey: string;
  label: string;
  startWeek: number;
  endWeek: number;
};

type MutableMonthStats = HeatmapMonthStats & {
  workedMinutesSum: number;
  workedDaysCount: number;
};

export function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** Aggregate per-calendar-month stats from the already-loaded heatmap day list. */
export function buildHeatmapMonthStats(days: AttendanceDayResult[]): Map<string, HeatmapMonthStats> {
  const map = new Map<string, MutableMonthStats>();

  for (const day of days) {
    const key = monthKeyFromDate(day.date);
    let stats = map.get(key);
    if (!stats) {
      stats = {
        monthKey: key,
        year: day.date.getFullYear(),
        monthIndex: day.date.getMonth(),
        label: monthLabelFromKey(key),
        presentDays: 0,
        excellentDays: 0,
        belowTargetDays: 0,
        absentDays: 0,
        leaveDays: 0,
        insufficientDays: 0,
        attendancePercent: null,
        averageWorkedMinutes: null,
        workedMinutesSum: 0,
        workedDaysCount: 0,
      };
      map.set(key, stats);
    }

    if (isPresentDay(day.category, day.ratioTier)) {
      stats.presentDays += 1;
      if (isExcellentPresentDay(day.category, day.ratioTier, day.checkOut)) stats.excellentDays += 1;
      else if (isBelowTargetPresentDay(day.category, day.ratioTier, day.checkOut)) stats.belowTargetDays += 1;
      stats.workedMinutesSum += day.workedMinutes;
      stats.workedDaysCount += 1;
    } else if (day.category === "ABSENT") {
      stats.absentDays += 1;
    } else if (day.category === "LEAVE") {
      stats.leaveDays += 1;
    } else if (day.category === "INSUFFICIENT_DATA") {
      stats.insufficientDays += 1;
    }
  }

  const result = new Map<string, HeatmapMonthStats>();
  for (const [key, stats] of map) {
    const denom = stats.presentDays + stats.absentDays + stats.insufficientDays;
    result.set(key, {
      monthKey: stats.monthKey,
      year: stats.year,
      monthIndex: stats.monthIndex,
      label: stats.label,
      presentDays: stats.presentDays,
      excellentDays: stats.excellentDays,
      belowTargetDays: stats.belowTargetDays,
      absentDays: stats.absentDays,
      leaveDays: stats.leaveDays,
      insufficientDays: stats.insufficientDays,
      attendancePercent: denom > 0 ? Math.round((stats.presentDays / denom) * 100) : null,
      averageWorkedMinutes:
        stats.workedDaysCount > 0 ? Math.round(stats.workedMinutesSum / stats.workedDaysCount) : null,
    });
  }

  return result;
}

/**
 * Week-index span for each month present in the GitHub-style week grid.
 * A week that straddles two months counts toward every month that has a day in it.
 */
export function buildMonthWeekRanges(
  weeks: (AttendanceDayResult | null)[][]
): MonthWeekRange[] {
  const byKey = new Map<string, { startWeek: number; endWeek: number }>();

  weeks.forEach((week, weekIndex) => {
    const keys = new Set<string>();
    for (const day of week) {
      if (day) keys.add(monthKeyFromDate(day.date));
    }
    for (const key of keys) {
      const existing = byKey.get(key);
      if (!existing) byKey.set(key, { startWeek: weekIndex, endWeek: weekIndex });
      else existing.endWeek = weekIndex;
    }
  });

  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, span]) => ({
      monthKey,
      label: monthLabelFromKey(monthKey),
      startWeek: span.startWeek,
      endWeek: span.endWeek,
    }));
}

export type WeekSpan = { startWeek: number; endWeek: number };

/**
 * Week-index span covering every day that falls in [start, end] — used to overlay an
 * arbitrary date range (the current attendance cycle) on the week grid, independent of
 * calendar-month boundaries (unlike `buildMonthWeekRanges`, which groups by month).
 */
export function buildCycleWeekSpan(
  weeks: (AttendanceDayResult | null)[][],
  start: Date,
  end: Date
): WeekSpan | null {
  let span: WeekSpan | null = null;

  weeks.forEach((week, weekIndex) => {
    const inRange = week.some((day) => day && day.date >= start && day.date <= end);
    if (!inRange) return;
    if (!span) span = { startWeek: weekIndex, endWeek: weekIndex };
    else span.endWeek = weekIndex;
  });

  return span;
}
