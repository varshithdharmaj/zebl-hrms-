import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

export function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function toISODate(date: Date): string {
  // Local calendar date, not UTC — `.toISOString()` would shift the date back a day
  // for any positive-UTC-offset timezone (e.g. IST) since these Date objects are built
  // with local-time setters (startOfDay/startOfMonth) but midnight-local != midnight-UTC.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(startOfDay(a)) === toISODate(startOfDay(b));
}

export function parseISODate(str?: string): Date | null {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = startOfDay(new Date(str + "T00:00:00"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Default period: 1st of current month through today */
export function defaultDateRange(): { start: string; end: string } {
  const end = startOfDay();
  const start = startOfMonth(end);
  return { start: toISODate(start), end: toISODate(end) };
}

export function parseDateRange(startStr?: string, endStr?: string) {
  const fallback = defaultDateRange();
  let start = parseISODate(startStr) ?? parseISODate(fallback.start)!;
  let end = parseISODate(endStr) ?? parseISODate(fallback.end)!;

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const rangeStart = startOfDay(start);
  const rangeEnd = endOfDay(end);

  const rangeLabel =
    toISODate(rangeStart) === toISODate(rangeEnd)
      ? rangeStart.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : `${rangeStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${rangeEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  return {
    rangeStart,
    rangeEnd,
    startIso: toISODate(rangeStart),
    endIso: toISODate(startOfDay(end)),
    rangeLabel,
  };
}
