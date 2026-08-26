import { endOfDay, startOfDay, toISODate } from "@/lib/utils";

export type PayrollPeriod = {
  start: Date;
  end: Date;
  /** URL-safe key e.g. 2025-04-25_2025-05-25 */
  key: string;
  label: string;
};

/** Local calendar date parts (timezone = server/local runtime) */
function dateAtLocalDay(year: number, month: number, day: number): Date {
  return startOfDay(new Date(year, month, day));
}

function clampPayrollDay(day: number): number {
  return Math.min(28, Math.max(1, Math.floor(day)));
}

/**
 * Payroll period: startDay of month A → startDay of month B (inclusive end day).
 * Example: Apr 25 → May 25 with startDay=25.
 */
export function buildPayrollPeriod(
  year: number,
  month: number,
  payrollStartDay: number
): PayrollPeriod {
  const startDay = clampPayrollDay(payrollStartDay);
  const start = dateAtLocalDay(year, month, startDay);

  const endMonth = month + 1;
  const endYear = endMonth > 11 ? year + 1 : year;
  const endMonthNorm = endMonth > 11 ? 0 : endMonth;
  const end = endOfDay(dateAtLocalDay(endYear, endMonthNorm, startDay));

  const startIso = toISODate(start);
  const endIso = toISODate(end);
  const startLabel = formatPeriodDate(start);
  const endLabel = formatPeriodDate(end);

  return {
    start,
    end,
    key: `${startIso}_${endIso}`,
    label: `${startLabel} → ${endLabel}`,
  };
}

function formatPeriodDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Active period containing refDate (default: current open cycle). */
export function getDefaultPayrollPeriod(
  payrollStartDay: number,
  refDate: Date = new Date()
): PayrollPeriod {
  const day = clampPayrollDay(payrollStartDay);
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const dom = refDate.getDate();

  if (dom >= day) {
    return buildPayrollPeriod(y, m, day);
  }
  const prevMonth = m === 0 ? 11 : m - 1;
  const prevYear = m === 0 ? y - 1 : y;
  return buildPayrollPeriod(prevYear, prevMonth, day);
}

export function listPayrollPeriodOptions(
  payrollStartDay: number,
  count = 12,
  refDate: Date = new Date()
): PayrollPeriod[] {
  const current = getDefaultPayrollPeriod(payrollStartDay, refDate);
  const options: PayrollPeriod[] = [current];
  let cursor = current.start;

  for (let i = 1; i < count; i++) {
    const prevMonth = cursor.getMonth() === 0 ? 11 : cursor.getMonth() - 1;
    const prevYear = cursor.getMonth() === 0 ? cursor.getFullYear() - 1 : cursor.getFullYear();
    const period = buildPayrollPeriod(prevYear, prevMonth, payrollStartDay);
    options.push(period);
    cursor = period.start;
  }

  return options;
}

export function parsePayrollPeriodKey(
  key: string | undefined,
  payrollStartDay: number
): PayrollPeriod {
  if (!key) return getDefaultPayrollPeriod(payrollStartDay);

  const match = key.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (!match) return getDefaultPayrollPeriod(payrollStartDay);

  const start = startOfDay(new Date(`${match[1]}T12:00:00`));
  const end = endOfDay(new Date(`${match[2]}T12:00:00`));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return getDefaultPayrollPeriod(payrollStartDay);
  }

  return {
    start,
    end,
    key,
    label: `${formatPeriodDate(start)} → ${formatPeriodDate(end)}`,
  };
}
