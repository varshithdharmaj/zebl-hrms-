import { startOfDay } from "@/lib/utils";

export type ElPolicyDates = {
  cycleStartDay: number;
  elEligibilityMonths: number;
  elExpiryMonths: number;
};

/**
 * Adds calendar months, clamping to the last valid day of the target month
 * when the source day doesn't exist there (e.g. 31 Jan + 1 month -> 28/29
 * Feb, never overflowing into March). This is a deliberate business rule
 * (confirmed): a 29th/30th/31st DOJ must land on the corresponding month-end,
 * not silently roll into the next month via raw Date-overflow arithmetic.
 *
 * Examples:
 *   31 Dec 2025 + 12mo -> 31 Dec 2026
 *   30 Nov 2025 + 12mo -> 30 Nov 2026
 *   31 Jan 2026 + 12mo -> 31 Jan 2027
 *   29 Feb 2024 (leap) + 12mo -> 28 Feb 2025 (2025 is not a leap year)
 */
function addCalendarMonths(date: Date, months: number): Date {
  const d = startOfDay(date);
  const targetMonthIndex = d.getMonth() + months;
  // Day 0 of (targetMonthIndex + 1) is the last day of targetMonthIndex —
  // `new Date` normalizes the month/year overflow either way.
  const daysInTargetMonth = new Date(d.getFullYear(), targetMonthIndex + 1, 0).getDate();
  const day = Math.min(d.getDate(), daysInTargetMonth);
  return new Date(d.getFullYear(), targetMonthIndex, day);
}

/** DOJ + elEligibilityMonths calendar months, via proper month arithmetic. */
export function getElEligibilityDate(joiningDate: Date, policy: ElPolicyDates): Date {
  return addCalendarMonths(joiningDate, policy.elEligibilityMonths);
}

/**
 * The first cycleStartDay (26th by default) on or after `eligibilityDate`.
 * If eligibility falls ON the cycle day, that same day's accrual is granted.
 * If eligibility falls AFTER the cycle day (later in the month), the first
 * applicable accrual is the following month's cycle day.
 */
export function getFirstElAccrualDate(eligibilityDate: Date, policy: ElPolicyDates): Date {
  const e = startOfDay(eligibilityDate);
  const monthOffset = e.getDate() <= policy.cycleStartDay ? 0 : 1;
  return new Date(e.getFullYear(), e.getMonth() + monthOffset, policy.cycleStartDay);
}

/** accrualDate + elExpiryMonths calendar months. */
export function getElExpiryDate(accrualDate: Date, policy: ElPolicyDates): Date {
  return addCalendarMonths(accrualDate, policy.elExpiryMonths);
}

/** Idempotency key for one employee's accrual in one cycle month, e.g. "2027-03". */
export function getCycleKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Every cycle-day accrual date from the employee's first eligible accrual
 * up to and including `asOf`'s cycle day (if `asOf` is on/after it), oldest first.
 * Returns [] if the employee is not yet eligible as of `asOf`.
 */
export function getElAccrualDatesUpTo(
  joiningDate: Date,
  policy: ElPolicyDates,
  asOf: Date = new Date()
): Date[] {
  const eligibility = getElEligibilityDate(joiningDate, policy);
  const asOfDay = startOfDay(asOf);
  if (asOfDay < eligibility) return [];

  const first = getFirstElAccrualDate(eligibility, policy);
  if (first > asOfDay) return [];

  const dates: Date[] = [];
  let cursor = first;
  while (cursor <= asOfDay) {
    dates.push(cursor);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, policy.cycleStartDay);
  }
  return dates;
}

/**
 * The 26th-to-25th leave cycle window containing `reference`.
 * On/after cycleStartDay -> this month's cycleStartDay through next month's (day-1).
 * Before cycleStartDay -> previous month's cycleStartDay through this month's (day-1).
 */
export function getLeaveCycleWindow(
  policy: ElPolicyDates,
  reference: Date = new Date()
): { startDate: Date; endDate: Date } {
  const ref = startOfDay(reference);
  const startMonthOffset = ref.getDate() >= policy.cycleStartDay ? 0 : -1;
  const startDate = new Date(ref.getFullYear(), ref.getMonth() + startMonthOffset, policy.cycleStartDay);
  const endDate = new Date(
    ref.getFullYear(),
    ref.getMonth() + startMonthOffset + 1,
    policy.cycleStartDay - 1
  );
  return { startDate, endDate };
}
