import {
  isWorkedDayCategory,
  isTargetOrBetterTier,
  type AttendanceDayResult,
} from "@/lib/attendance/day-classification";

/**
 * Pure streak calculation utilities for the attendance heatmap. Streaks count
 * consecutive qualifying working days (target or overtime tier) while ignoring
 * neutral non-working days (leave, holiday, weekly-off) and breaking on
 * absent/insufficient-data/short-hours days.
 *
 * Month-boundary limitation: these functions only operate on the days provided
 * (typically one calendar month) and do not fetch adjacent-period data. A streak
 * that began in the previous month will appear artificially short.
 */

/** A day that met or exceeded the expected target. */
function isQualifyingDay(day: AttendanceDayResult): boolean {
  return isWorkedDayCategory(day.category) && isTargetOrBetterTier(day.ratioTier);
}

/** A day that definitively ends an active streak. */
function isBreakingDay(day: AttendanceDayResult): boolean {
  if (day.category === "ABSENT" || day.category === "INSUFFICIENT_DATA") return true;
  // Worked days that didn't meet target (very_low/partial/near_target) break the streak.
  if (isWorkedDayCategory(day.category) && !isTargetOrBetterTier(day.ratioTier)) return true;
  // Non-breaking categories: LEAVE, HOLIDAY, WEEKLY_OFF (neutral, don't break streak).
  return false;
}

export type StreakResult = {
  /** Consecutive qualifying working days counting backward from the most recent
   *  relevant date (today or the last day of the month if today is in the future). */
  currentStreak: number;
  /** Longest sequence of qualifying working days found within the provided period. */
  bestStreak: number;
  /** Count of all qualifying days in the period (useful for summary metrics). */
  targetDaysCount: number;
};

/**
 * Calculate current streak, best streak, and target days count from an array of
 * classified attendance days. Days should be in chronological order (oldest first).
 *
 * Current streak starts from the most recent *relevant* date (ignoring future dates
 * and neutral non-working days at the end) and counts backward through qualifying
 * days until hitting a breaking day.
 *
 * Best streak scans the entire period for the longest qualifying sequence.
 *
 * @param days - Chronologically ordered array of classified attendance days
 * @param today - The current date (used to exclude future dates from current streak)
 * @returns Streak statistics
 */
export function calculateStreaks(days: AttendanceDayResult[], today: Date = new Date()): StreakResult {
  if (days.length === 0) {
    return { currentStreak: 0, bestStreak: 0, targetDaysCount: 0 };
  }

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const relevantDays = days.filter((d) => d.date <= todayMidnight);

  // Count all qualifying days (for summary metric).
  const targetDaysCount = relevantDays.filter(isQualifyingDay).length;

  // Current streak: count backward from the most recent relevant date.
  let currentStreak = 0;
  for (let i = relevantDays.length - 1; i >= 0; i--) {
    const day = relevantDays[i]!;

    if (isQualifyingDay(day)) {
      currentStreak++;
    } else if (isBreakingDay(day)) {
      break; // Streak definitively ends.
    }
    // Neutral days (leave/holiday/weekly-off) are skipped; streak continues.
  }

  // Best streak: scan forward through all days, tracking the longest qualifying run.
  let bestStreak = 0;
  let runningStreak = 0;

  for (const day of relevantDays) {
    if (isQualifyingDay(day)) {
      runningStreak++;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else if (isBreakingDay(day)) {
      runningStreak = 0; // Reset on breaking day.
    }
    // Neutral days do not reset the running streak.
  }

  return { currentStreak, bestStreak, targetDaysCount };
}
