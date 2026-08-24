import { startOfDay } from "@/lib/utils";

export type ElPolicyDates = {
  cycleStartDay: number;
  elEligibilityMonths: number;
  elExpiryMonths: number;
};

/**
 * Adds calendar months using Date's own month-overflow normalization
 * (e.g. 31 Jan + 1 month -> 3 Mar, never approximated as 30-day months).
 * Mirrors the technique already proven in attendance-cycle.ts.
 */
function addCalendarMonths(date: Date, months: number): Date {
  const d = startOfDay(date);
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
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
