/** Calendar month (1–12) and year for interview list filtering. */
export type CalendarMonthYear = {
  month: number;
  year: number;
};

/**
 * Resolve calendar month/year from URL search params.
 * Uses the same local-date semantics as `InterviewCalendar` (`new Date(year, month, day)`).
 */
export function resolveCalendarMonthYear(
  rawMonth: string | string[] | undefined,
  rawYear: string | string[] | undefined,
  now: Date = new Date()
): CalendarMonthYear {
  const yearRaw = Array.isArray(rawYear) ? rawYear[0] : rawYear;
  const monthRaw = Array.isArray(rawMonth) ? rawMonth[0] : rawMonth;

  const parsedYear = yearRaw ? Number.parseInt(yearRaw, 10) : now.getFullYear();
  const parsedMonth = monthRaw ? Number.parseInt(monthRaw, 10) : now.getMonth() + 1;

  const year =
    Number.isFinite(parsedYear) && parsedYear >= 1970 && parsedYear <= 2100
      ? parsedYear
      : now.getFullYear();
  const month =
    Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : now.getMonth() + 1;

  return { month, year };
}

/** Inclusive local-time range for a calendar month (month is 1–12). */
export function calendarMonthRange(
  year: number,
  month: number
): { scheduledStartFrom: Date; scheduledStartTo: Date } {
  const scheduledStartFrom = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const scheduledStartTo = new Date(year, month, 0, 23, 59, 59, 999);
  return { scheduledStartFrom, scheduledStartTo };
}

export function buildInterviewCalendarHref(args: {
  view: string;
  layout: string;
  month: number;
  year: number;
}): string {
  const params = new URLSearchParams({
    view: args.view,
    layout: args.layout,
    month: String(args.month),
    year: String(args.year),
  });
  return `/admin/recruitment/interviews?${params.toString()}`;
}
