"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar, type CalendarRange } from "@/components/ui/calendar";
import { Popover } from "@/components/ui/popover";
import { Sheet } from "@/components/ui/sheet";
import {
  DATE_RANGE_PRESET_LABELS,
  QUICK_DATE_RANGE_PRESETS,
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

type Layout = "default" | "compact" | "inline";

export function DateRangeFilter({
  defaultStart,
  defaultEnd,
  defaultPreset,
  startParam = "start",
  endParam = "end",
  presetParam = "preset",
  layout = "default",
  showPresets = true,
  className,
}: {
  defaultStart: string;
  defaultEnd: string;
  defaultPreset?: DateRangePreset;
  startParam?: string;
  endParam?: string;
  presetParam?: string;
  layout?: Layout;
  showPresets?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const applied = useMemo(() => {
    const parsed = readDateRangeFromSearchParams(searchParams, {
      fromParam: startParam,
      toParam: endParam,
      presetParam,
    });
    const hasUrlRange =
      searchParams.has(startParam) ||
      searchParams.has(endParam) ||
      searchParams.has("from") ||
      searchParams.has("to") ||
      searchParams.has(presetParam);

    if (!hasUrlRange) {
      const from = defaultStart;
      const to = defaultEnd;
      const preset = defaultPreset ?? matchPreset(from, to);
      return {
        from,
        to,
        preset,
        shortLabel: formatDateRangeShort(from, to),
      };
    }

    return {
      from: parsed.from,
      to: parsed.to,
      preset: parsed.preset,
      shortLabel: parsed.shortLabel,
    };
  }, [
    searchParams,
    startParam,
    endParam,
    presetParam,
    defaultStart,
    defaultEnd,
    defaultPreset,
  ]);

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
      fromParam: startParam,
      toParam: endParam,
      presetParam,
      legacyFromParam: startParam === "from" ? "start" : "from",
      legacyToParam: endParam === "to" ? "end" : "to",
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
  const presetLabel =
    DATE_RANGE_PRESET_LABELS[applied.preset] ?? DATE_RANGE_PRESET_LABELS.custom;
  const triggerDescription = `${presetLabel}, ${applied.shortLabel}`;

  // layout retained for API compatibility with existing call sites
  void layout;

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="inline-flex h-auto min-h-9 max-w-full items-center gap-2 rounded-xl border-border bg-card px-3 py-1.5 text-left"
      aria-haspopup="dialog"
      aria-expanded={open || mobileOpen}
      aria-label={`Date range: ${triggerDescription}`}
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
      <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className="text-xs font-semibold text-foreground">{presetLabel}</span>
        <span className="text-[0.7rem] text-muted-foreground">{applied.shortLabel}</span>
      </span>
      <ChevronDown
        className={cn(
          "ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
          (open || mobileOpen) && "rotate-180"
        )}
        aria-hidden
      />
    </Button>
  );

  const panel = (
    <DateRangePanel
      showPresets={showPresets}
      appliedPreset={applied.preset}
      draft={draft}
      onDraftChange={setDraft}
      onPreset={applyPreset}
      onApply={applyCustom}
      onCancel={cancelDraft}
      canApply={canApply}
      maxDate={todayIso()}
    />
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="hidden sm:block">
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (!next) cancelDraft();
            else setOpen(true);
          }}
          trigger={triggerButton}
          contentClassName="w-[min(100vw-2rem,24rem)] p-0"
        >
          <div className="p-3">{panel}</div>
        </Popover>
      </div>

      <div className="sm:hidden">
        {triggerButton}
        <Sheet
          open={mobileOpen}
          onClose={cancelDraft}
          title="Date range"
          description="Choose a quick range or pick custom dates."
        >
          {panel}
        </Sheet>
      </div>
    </div>
  );
}

function DateRangePanel({
  showPresets,
  appliedPreset,
  draft,
  onDraftChange,
  onPreset,
  onApply,
  onCancel,
  canApply,
  maxDate,
}: {
  showPresets: boolean;
  appliedPreset: DateRangePreset;
  draft: CalendarRange;
  onDraftChange: (range: CalendarRange) => void;
  onPreset: (preset: Exclude<DateRangePreset, "custom">) => void;
  onApply: () => void;
  onCancel: () => void;
  canApply: boolean;
  maxDate: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {showPresets && (
        <div className="space-y-1.5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Quick presets
          </p>
          <div
            className="grid grid-cols-2 gap-1.5 sm:grid-cols-3"
            role="group"
            aria-label="Quick date ranges"
          >
            {QUICK_DATE_RANGE_PRESETS.map((preset) => {
              const active = appliedPreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onPreset(preset)}
                  className={cn(
                    "rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    active
                      ? "bg-primary text-primary-foreground shadow-subtle"
                      : "bg-muted text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  {DATE_RANGE_PRESET_LABELS[preset]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="h-px bg-border" role="separator" />

      <div className="space-y-1.5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Custom range
        </p>
        <Calendar selected={draft} onSelect={onDraftChange} maxDate={maxDate} />
        <p className="text-[0.7rem] text-muted-foreground" aria-live="polite">
          {draft.from && draft.to
            ? `Selected ${formatDateRangeShort(draft.from, draft.to)}`
            : draft.from
              ? `Start ${formatDateRangeShort(draft.from, draft.from)} — select an end date`
              : "Select a start and end date"}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!canApply} onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}
