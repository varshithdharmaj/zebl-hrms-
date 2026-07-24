"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar, type CalendarRange } from "@/components/ui/calendar";
import { Popover } from "@/components/ui/popover";
import { Sheet } from "@/components/ui/sheet";
import {
  applyDateRangeToSearchParams,
  formatDateRangeShort,
  getPresetRange,
  matchPreset,
  readDateRangeFromSearchParams,
  todayIso,
  type DateRangeIso,
  type DateRangePreset,
} from "@/lib/date-range";
import { cn } from "@/lib/utils";

/** Analytics-style chips for the Employee Dashboard only. */
const DASHBOARD_PRESETS: {
  id: Exclude<DateRangePreset, "custom" | "yesterday">;
  label: string;
}[] = [
  { id: "today", label: "1D" },
  { id: "last-7-days", label: "7D" },
  { id: "last-30-days", label: "30D" },
  { id: "this-month", label: "MTD" },
  { id: "last-month", label: "Last Month" },
];

/**
 * Employee Dashboard date navigation:
 * quick presets primary, custom calendar secondary via the date trigger.
 */
export function DashboardDateRangeFilter({
  defaultStart,
  defaultEnd,
  defaultPreset = "this-month",
}: {
  defaultStart: string;
  defaultEnd: string;
  defaultPreset?: DateRangePreset;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const applied = useMemo(() => {
    const parsed = readDateRangeFromSearchParams(searchParams, {
      fromParam: "from",
      toParam: "to",
      presetParam: "preset",
    });
    const hasUrlRange =
      searchParams.has("from") ||
      searchParams.has("to") ||
      searchParams.has("start") ||
      searchParams.has("end") ||
      searchParams.has("preset");

    if (!hasUrlRange) {
      const from = defaultStart;
      const to = defaultEnd;
      const preset = defaultPreset ?? matchPreset(from, to);
      return { from, to, preset, shortLabel: formatDateRangeShort(from, to) };
    }

    return {
      from: parsed.from,
      to: parsed.to,
      preset: parsed.preset,
      shortLabel: parsed.shortLabel,
    };
  }, [searchParams, defaultStart, defaultEnd, defaultPreset]);

  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarRange>({
    from: applied.from,
    to: applied.to,
  });

  useEffect(() => {
    if (!open && !mobileOpen) {
      setDraft({ from: applied.from, to: applied.to });
    }
  }, [open, mobileOpen, applied.from, applied.to]);

  function pushRange(value: DateRangeIso) {
    const next = applyDateRangeToSearchParams(searchParams, value, {
      fromParam: "from",
      toParam: "to",
      presetParam: "preset",
      legacyFromParam: "start",
      legacyToParam: "end",
    });
    next.delete("date");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function applyPreset(preset: Exclude<DateRangePreset, "custom">) {
    const range = getPresetRange(preset);
    pushRange({ from: range.from, to: range.to, preset });
    setOpen(false);
    setMobileOpen(false);
  }

  function applyCustom() {
    if (!draft.from || !draft.to) return;
    pushRange({ from: draft.from, to: draft.to, preset: "custom" });
    setOpen(false);
    setMobileOpen(false);
  }

  function cancelDraft() {
    setDraft({ from: applied.from, to: applied.to });
    setOpen(false);
    setMobileOpen(false);
  }

  const canApply = Boolean(draft.from && draft.to);
  const activeChipId =
    applied.preset === "custom" || applied.preset === "yesterday"
      ? null
      : applied.preset;

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border-border bg-card px-2.5 text-xs font-medium"
      aria-haspopup="dialog"
      aria-expanded={open || mobileOpen}
      aria-label={`Custom date range: ${applied.shortLabel}`}
      onClick={() => {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) {
          setMobileOpen(true);
          setOpen(false);
        } else {
          setOpen((v) => !v);
          setMobileOpen(false);
        }
      }}
    >
      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span className="whitespace-nowrap tabular-nums text-foreground">{applied.shortLabel}</span>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 text-muted-foreground transition-transform",
          (open || mobileOpen) && "rotate-180"
        )}
        aria-hidden
      />
    </Button>
  );

  const customPanel = (
    <div className="flex flex-col gap-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        Custom range
      </p>
      <Calendar
        selected={draft}
        onSelect={setDraft}
        maxDate={todayIso()}
      />
      <p className="text-[0.7rem] text-muted-foreground" aria-live="polite">
        {draft.from && draft.to
          ? `Selected ${formatDateRangeShort(draft.from, draft.to)}`
          : "Select a start and end date"}
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={cancelDraft}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!canApply} onClick={applyCustom}>
          Apply
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Quick date ranges"
      >
        {DASHBOARD_PRESETS.map((preset) => {
          const active = activeChipId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              aria-pressed={active}
              className={cn(
                "inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                active
                  ? "bg-primary text-primary-foreground shadow-subtle"
                  : "bg-muted text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="hidden sm:block">
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (!next) cancelDraft();
            else setOpen(true);
          }}
          trigger={triggerButton}
          contentClassName="w-[min(100vw-2rem,22rem)] p-0"
        >
          <div className="p-3">{customPanel}</div>
        </Popover>
      </div>

      <div className="sm:hidden">
        {triggerButton}
        <Sheet
          open={mobileOpen}
          onClose={cancelDraft}
          title="Custom date range"
          description="Pick a start and end date, then Apply."
        >
          {customPanel}
        </Sheet>
      </div>
    </div>
  );
}
