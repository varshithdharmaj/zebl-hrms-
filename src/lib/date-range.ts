import {
  addDays,
  endOfMonth,
  parseISODate,
  startOfDay,
  startOfMonth,
  toISODate,
} from "@/lib/utils";

export const DATE_RANGE_PRESETS = [
  "today",
  "yesterday",
  "last-7-days",
  "last-30-days",
  "this-month",
  "last-month",
  "custom",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export type DateRangeValue = {
  from: Date;
  to: Date;
  preset: DateRangePreset;
};

export type DateRangeIso = {
  from: string;
  to: string;
  preset: DateRangePreset;
};

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "last-7-days": "Last 7 days",
  "last-30-days": "Last 30 days",
  "this-month": "This month",
  "last-month": "Last month",
  custom: "Custom",
};

/** Quick presets shown in the picker (excludes custom). */
export const QUICK_DATE_RANGE_PRESETS: Exclude<DateRangePreset, "custom">[] = [
  "today",
  "yesterday",
  "last-7-days",
  "last-30-days",
  "this-month",
  "last-month",
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateRangePreset(value: string | null | undefined): value is DateRangePreset {
  return !!value && (DATE_RANGE_PRESETS as readonly string[]).includes(value);
}

export function todayIso(now: Date = new Date()): string {
  return toISODate(startOfDay(now));
}

/** Clamp an inclusive ISO date so it never exceeds today (local calendar). */
export function clampIsoToToday(iso: string, now: Date = new Date()): string {
  const today = todayIso(now);
  return iso > today ? today : iso;
}

export function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  const parsed = parseISODate(value);
  return parsed !== null && toISODate(parsed) === value;
}

/**
 * Inclusive calendar day → exclusive upper bound at local midnight of the next day.
 * Prefer `gte: from, lt: toExclusive` over `lte: endOfDay`.
 */
export function toExclusiveUpperBound(inclusiveEnd: Date | string): Date {
  const day =
    typeof inclusiveEnd === "string"
      ? parseISODate(inclusiveEnd) ?? startOfDay()
      : startOfDay(inclusiveEnd);
  return startOfDay(addDays(day, 1));
}

export function getPresetRange(
  preset: Exclude<DateRangePreset, "custom">,
  now: Date = new Date()
): { from: string; to: string } {
  const today = startOfDay(now);
  const todayStr = toISODate(today);

  switch (preset) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      const iso = toISODate(yesterday);
      return { from: iso, to: iso };
    }
    case "last-7-days": {
      const from = addDays(today, -6);
      return { from: toISODate(from), to: todayStr };
    }
    case "last-30-days": {
      const from = addDays(today, -29);
      return { from: toISODate(from), to: todayStr };
    }
    case "this-month": {
      return { from: toISODate(startOfMonth(today)), to: todayStr };
    }
    case "last-month": {
      const firstOfThisMonth = startOfMonth(today);
      const lastMonthEnd = addDays(firstOfThisMonth, -1);
      const lastMonthStart = startOfMonth(lastMonthEnd);
      return {
        from: toISODate(lastMonthStart),
        to: toISODate(startOfDay(endOfMonth(lastMonthEnd))),
      };
    }
  }
}

/** Infer which quick preset matches an inclusive ISO range, else `custom`. */
export function matchPreset(from: string, to: string, now: Date = new Date()): DateRangePreset {
  for (const preset of QUICK_DATE_RANGE_PRESETS) {
    const range = getPresetRange(preset, now);
    if (range.from === from && range.to === to) return preset;
  }
  return "custom";
}

export function defaultDateRangeValue(now: Date = new Date()): DateRangeIso {
  const range = getPresetRange("this-month", now);
  return { from: range.from, to: range.to, preset: "this-month" };
}

export type ParsedDateRangeQuery = DateRangeIso & {
  fromDate: Date;
  toDate: Date;
  /** Exclusive upper bound for Prisma: `lt: toExclusive`. */
  toExclusive: Date;
  rangeLabel: string;
  shortLabel: string;
};

/**
 * Normalize URL / form date-range inputs.
 * - Accepts `from`/`to` or legacy `start`/`end`
 * - Invalid / missing → this-month default
 * - Future dates clamped to today
 * - Reversed ranges swapped
 * - Known presets recompute bounds (so stale URLs stay correct)
 */
export function parseDateRangeQuery(input: {
  from?: string | null;
  to?: string | null;
  start?: string | null;
  end?: string | null;
  preset?: string | null;
  now?: Date;
}): ParsedDateRangeQuery {
  const now = input.now ?? new Date();
  const fallback = defaultDateRangeValue(now);

  const rawFrom = input.from ?? input.start ?? null;
  const rawTo = input.to ?? input.end ?? null;
  const rawPreset = input.preset;

  if (isDateRangePreset(rawPreset) && rawPreset !== "custom") {
    const range = getPresetRange(rawPreset, now);
    return buildParsed(range.from, range.to, rawPreset, now);
  }

  let from = isValidIsoDate(rawFrom) ? clampIsoToToday(rawFrom, now) : fallback.from;
  let to = isValidIsoDate(rawTo) ? clampIsoToToday(rawTo, now) : fallback.to;

  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  const preset =
    isDateRangePreset(rawPreset) && rawPreset === "custom"
      ? "custom"
      : matchPreset(from, to, now);

  return buildParsed(from, to, preset, now);
}

function buildParsed(
  from: string,
  to: string,
  preset: DateRangePreset,
  now: Date
): ParsedDateRangeQuery {
  const fromDate = parseISODate(from) ?? startOfDay(now);
  const toDate = parseISODate(to) ?? startOfDay(now);
  return {
    from,
    to,
    preset,
    fromDate,
    toDate,
    toExclusive: toExclusiveUpperBound(toDate),
    rangeLabel: formatDateRangeLabel(from, to),
    shortLabel: formatDateRangeShort(from, to),
  };
}

/** Compact closed-state dates: `Jul 01 – Jul 23` */
export function formatDateRangeShort(from: string, to: string): string {
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (!a || !b) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  if (from === to) return fmt(a);
  return `${fmt(a)} – ${fmt(b)}`;
}

/** Longer label used in summaries: includes year when needed. */
export function formatDateRangeLabel(from: string, to: string): string {
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (!a || !b) return "";
  if (from === to) {
    return a.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" as const }),
  });
  const right = b.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${left} – ${right}`;
}

export type DateRangeSearchParamNames = {
  fromParam?: string;
  toParam?: string;
  /** Legacy aliases also cleared/written when set. */
  legacyFromParam?: string;
  legacyToParam?: string;
  presetParam?: string;
};

/**
 * Apply a date range onto URLSearchParams.
 * Defaults write `start`/`end`/`preset` (existing app contract).
 * Pass fromParam=`from`, toParam=`to` for the canonical names in the product brief.
 */
export function applyDateRangeToSearchParams(
  params: URLSearchParams,
  value: DateRangeIso,
  names: DateRangeSearchParamNames = {}
): URLSearchParams {
  const fromParam = names.fromParam ?? "start";
  const toParam = names.toParam ?? "end";
  const presetParam = names.presetParam ?? "preset";
  const next = new URLSearchParams(params.toString());

  next.set(fromParam, value.from);
  next.set(toParam, value.to);
  next.set(presetParam, value.preset);

  if (names.legacyFromParam && names.legacyFromParam !== fromParam) {
    next.delete(names.legacyFromParam);
  }
  if (names.legacyToParam && names.legacyToParam !== toParam) {
    next.delete(names.legacyToParam);
  }

  next.delete("page");
  return next;
}

/** Read range from URLSearchParams with from/to + start/end alias support. */
export function readDateRangeFromSearchParams(
  params: URLSearchParams,
  names: DateRangeSearchParamNames = {},
  now?: Date
): ParsedDateRangeQuery {
  const fromParam = names.fromParam ?? "start";
  const toParam = names.toParam ?? "end";
  const presetParam = names.presetParam ?? "preset";
  const legacyFrom = names.legacyFromParam;
  const legacyTo = names.legacyToParam;

  // Prefer canonical `from`/`to`, then configured names, then legacy aliases.
  const from =
    params.get("from") ??
    params.get(fromParam) ??
    (legacyFrom ? params.get(legacyFrom) : null) ??
    params.get("start");
  const to =
    params.get("to") ??
    params.get(toParam) ??
    (legacyTo ? params.get(legacyTo) : null) ??
    params.get("end");

  return parseDateRangeQuery({
    from,
    to,
    preset: params.get(presetParam),
    now,
  });
}
