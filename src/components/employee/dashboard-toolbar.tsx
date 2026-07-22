"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn, formatDate, startOfDay, startOfMonth, toISODate } from "@/lib/utils";

type Preset = { id: string; label: string; start: string; end: string };

function getPresets(): Preset[] {
  const today = startOfDay();
  const todayIso = toISODate(today);
  const monthStart = toISODate(startOfMonth(today));

  const last7 = new Date(today);
  last7.setDate(last7.getDate() - 6);

  const last30 = new Date(today);
  last30.setDate(last30.getDate() - 29);

  return [
    { id: "month", label: "This month", start: monthStart, end: todayIso },
    { id: "7d", label: "Last 7 days", start: toISODate(last7), end: todayIso },
    { id: "30d", label: "Last 30 days", start: toISODate(last30), end: todayIso },
  ];
}

export function DashboardToolbar({
  defaultDate,
  defaultStart,
  defaultEnd,
  layout = "default",
  showDayPicker = true,
  showRange = true,
}: {
  defaultDate: string;
  defaultStart: string;
  defaultEnd: string;
  layout?: "default" | "compact" | "inline";
  showDayPicker?: boolean;
  showRange?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const date = searchParams.get("date") ?? defaultDate;
  const rawStart = searchParams.get("start") ?? defaultStart;
  const rawEnd = searchParams.get("end") ?? defaultEnd;
  // Mirror the server's own start/end swap (parseDateRange) so the displayed range,
  // active-preset match, and "applied filters" chip never disagree with what's queried.
  const [start, end] = rawStart <= rawEnd ? [rawStart, rawEnd] : [rawEnd, rawStart];

  const [viewOpen, setViewOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rangeDraftStart, setRangeDraftStart] = useState(start);
  const [rangeDraftEnd, setRangeDraftEnd] = useState(end);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const filtersMenuRef = useRef<HTMLDivElement>(null);

  // Keep draft range in sync with applied range when panel closes
  useEffect(() => {
    if (!filtersOpen) {
      setRangeDraftStart(start);
      setRangeDraftEnd(end);
    }
  }, [filtersOpen, start, end]);

  // Close popover on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setViewOpen(false);
        setFiltersOpen(false);
      }
    }
    if (viewOpen || filtersOpen) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [viewOpen, filtersOpen]);

  // Close on outside click. Skip entirely for clicks inside an open dialog (the mobile
  // filters Sheet) — it already closes itself via its own backdrop click and Escape handling.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (target instanceof Element && target.closest('[role="dialog"]')) return;
      if (viewOpen && !viewMenuRef.current?.contains(target)) setViewOpen(false);
      if (filtersOpen && !filtersMenuRef.current?.contains(target)) setFiltersOpen(false);
    }
    if (viewOpen || filtersOpen) {
      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }
  }, [viewOpen, filtersOpen]);

  function push(params: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) p.set(key, value);
      else p.delete(key);
    });
    // Changing date or range resets pagination
    if ("date" in params || "start" in params || "end" in params) {
      p.delete("page");
    }
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function pushDate(value: string | null) {
    push({ date: value });
  }

  function applyRange(nextStart: string, nextEnd: string) {
    push({ start: nextStart, end: nextEnd, date: null });
  }

  function resetRange() {
    setRangeDraftStart(defaultStart);
    setRangeDraftEnd(defaultEnd);
  }

  const presets = useMemo(() => getPresets(), []);

  const activePreset = useMemo(
    () => presets.find((p) => p.start === start && p.end === end) ?? null,
    [presets, start, end]
  );

  const isPresetRange = !!activePreset;

  const hasCustomRange = useMemo(
    () =>
      showRange &&
      (start !== defaultStart || end !== defaultEnd) &&
      !isPresetRange,
    [showRange, start, end, defaultStart, defaultEnd, isPresetRange]
  );

  const rangeLabel = useMemo(() => {
    if (!showRange) return "";
    if (!start || !end) return "";
    if (start === end) return formatDate(new Date(start));
    return `${formatDate(new Date(start))} – ${formatDate(new Date(end))}`;
  }, [showRange, start, end]);

  const viewLabel = useMemo(() => {
    if (date && showDayPicker) {
      return "View day";
    }
    if (activePreset) {
      return activePreset.label;
    }
    if (hasCustomRange) {
      return "Custom range";
    }
    return "View";
  }, [date, showDayPicker, activePreset, hasCustomRange]);

  const containerClasses =
    layout === "inline"
      ? "flex flex-col gap-2"
      : layout === "compact"
      ? "space-y-3"
      : "space-y-3";

  const toolbarRowClasses =
    layout === "inline"
      ? "flex flex-wrap items-center gap-2"
      : "flex flex-wrap items-center justify-between gap-2";

  function ViewMenu() {
    return (
      <div className="relative" ref={viewMenuRef}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-2 rounded-xl border-border bg-card px-3 text-xs font-medium"
          onClick={() => {
            setFiltersOpen(false);
            setViewOpen((open) => !open);
          }}
          aria-haspopup="true"
          aria-expanded={viewOpen}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>{viewLabel}</span>
        </Button>
        {viewOpen && (
          <div
            className="absolute z-30 mt-2 w-64 rounded-xl border border-border bg-popover p-2 text-xs shadow-lg"
            role="menu"
          >
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  pushDate(null);
                  setViewOpen(false);
                }}
              >
                <span>Today</span>
                <span className="text-[0.65rem] uppercase text-muted-foreground">Reset</span>
              </button>

              {showDayPicker && (
                <div className="mt-1 space-y-1 rounded-md bg-muted/50 p-2">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    View day
                  </p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    Affects today&apos;s status and attendance detail
                  </p>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      pushDate(e.target.value);
                      setViewOpen(false);
                    }}
                    className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </div>
              )}

              {showRange && (
                <>
                  <div className="mt-2 border-t border-border/60 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Quick ranges
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground">
                    Affects KPI summary and attendance history
                  </p>
                  <div className="mt-1 flex flex-col gap-1" role="group" aria-label="Quick date ranges">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          applyRange(p.start, p.end);
                          setViewOpen(false);
                        }}
                        className={cn(
                          "rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                          p.start === start && p.end === end
                            ? "bg-primary text-primary-foreground shadow-subtle"
                            : "bg-muted text-muted-foreground hover:bg-card hover:text-foreground"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function FiltersPanel() {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Date range
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Start date</label>
              <input
                type="date"
                value={rangeDraftStart}
                max={rangeDraftEnd}
                onChange={(e) => setRangeDraftStart(e.target.value)}
                className="h-9 rounded-lg border border-input bg-card px-3 text-xs shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">End date</label>
              <input
                type="date"
                value={rangeDraftEnd}
                min={rangeDraftStart}
                onChange={(e) => setRangeDraftEnd(e.target.value)}
                className="h-9 rounded-lg border border-input bg-card px-3 text-xs shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              resetRange();
            }}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            className="text-xs"
            onClick={() => {
              applyRange(rangeDraftStart, rangeDraftEnd);
              setFiltersOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    );
  }

  function FiltersButton() {
    if (!showRange) return null;

    return (
      <>
        {/* Desktop popover */}
        <div className="relative hidden sm:block" ref={filtersMenuRef}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2 rounded-xl border-border bg-card px-3 text-xs font-medium"
            onClick={() => {
              setViewOpen(false);
              setFiltersOpen((open) => !open);
            }}
            aria-haspopup="true"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>
              Advanced filters
              {hasCustomRange && <span className="ml-1 text-[0.65rem] text-primary">· 1</span>}
            </span>
          </Button>
          {filtersOpen && (
            <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-border bg-popover p-3 text-xs shadow-lg">
              <FiltersPanel />
            </div>
          )}
        </div>

        {/* Mobile sheet */}
        <div className="sm:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2 rounded-xl border-border bg-card px-3 text-xs font-medium"
            onClick={() => {
              setViewOpen(false);
              setFiltersOpen(true);
            }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>
              Advanced filters
              {hasCustomRange && <span className="ml-1 text-[0.65rem] text-primary">· 1</span>}
            </span>
          </Button>
          <Sheet
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            title="Filters"
            description="Refine your attendance view."
          >
            <FiltersPanel />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <div className={containerClasses}>
      <div className={toolbarRowClasses}>
        <div className="flex flex-col gap-1">
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            View
          </span>
          <ViewMenu />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Advanced filters
          </span>
          <FiltersButton />
        </div>
      </div>

      {hasCustomRange && rangeLabel && (
        <div className="space-y-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Applied filters
          </p>
          <div className="inline-flex h-8 items-center gap-2 rounded-full border border-border/60 bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground shadow-subtle">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="max-w-[11rem] truncate">{rangeLabel}</span>
            <button
              type="button"
              onClick={() => applyRange(defaultStart, defaultEnd)}
              className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
              aria-label="Clear custom date range"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
