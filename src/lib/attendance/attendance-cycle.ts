import { formatDate, startOfDay } from "@/lib/utils";

/** The attendance cycle always anchors on the 25th of a month. */
const CYCLE_ANCHOR_DAY = 25;

export type AttendanceCycleWindow = {
  /** Local midnight on the cycle's opening 25th. */
  startDate: Date;
  /** Local midnight on the cycle's closing 25th (inclusive, may be in the future). */
  endDate: Date;
  /** Every local calendar date in [startDate, endDate], inclusive, oldest first. */
  dates: Date[];
};

/**
 * The active 25th-to-25th attendance cycle containing `reference` (defaults to today).
 * On/after the 25th → this month's 25th through next month's 25th.
 * Before the 25th → previous month's 25th through this month's 25th.
 * Relies on `Date`'s own month-overflow normalization for year/leap-year boundaries —
 * no manual day-count math.
 */
export function getAttendanceCycleWindow(reference: Date = new Date()): AttendanceCycleWindow {
  const ref = startOfDay(reference);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const startMonthOffset = ref.getDate() >= CYCLE_ANCHOR_DAY ? 0 : -1;

  const startDate = new Date(year, month + startMonthOffset, CYCLE_ANCHOR_DAY);
  const endDate = new Date(year, month + startMonthOffset + 1, CYCLE_ANCHOR_DAY);

  const dates: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return { startDate, endDate, dates };
}

/** Human label for a cycle window, e.g. "25 Jul 2026 – 25 Aug 2026". */
export function formatAttendanceCycleLabel(window: AttendanceCycleWindow): string {
  return `${formatDate(window.startDate)} – ${formatDate(window.endDate)}`;
}
