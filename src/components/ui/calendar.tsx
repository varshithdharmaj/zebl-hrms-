"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, startOfDay, startOfMonth, toISODate } from "@/lib/utils";

export type CalendarRange = {
  from?: string;
  to?: string;
};

type CalendarProps = {
  month?: Date;
  onMonthChange?: (month: Date) => void;
  selected?: CalendarRange;
  onSelect?: (range: CalendarRange) => void;
  /** Inclusive ISO dates at/after this are disabled. Defaults to tomorrow (blocks future). */
  maxDate?: string;
  className?: string;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function monthMatrix(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const startPad = first.getDay();
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(first.getFullYear(), first.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function Calendar({
  month: controlledMonth,
  onMonthChange,
  selected,
  onSelect,
  maxDate,
  className,
}: CalendarProps) {
  const today = startOfDay();
  const todayIso = toISODate(today);
  const maxIso = maxDate ?? toISODate(today);

  const [uncontrolledMonth, setUncontrolledMonth] = useState(() =>
    startOfMonth(selected?.from ? new Date(selected.from + "T00:00:00") : today)
  );

  const month = controlledMonth ? startOfMonth(controlledMonth) : uncontrolledMonth;

  function setMonth(next: Date) {
    const normalized = startOfMonth(next);
    if (onMonthChange) onMonthChange(normalized);
    else setUncontrolledMonth(normalized);
  }

  const cells = useMemo(() => monthMatrix(month), [month]);
  const title = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const canGoNext = (() => {
    const nextMonthStart = startOfMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
    return toISODate(nextMonthStart) <= maxIso;
  })();

  function handleDayClick(day: Date) {
    if (!onSelect) return;
    const iso = toISODate(day);
    if (iso > maxIso) return;

    const { from, to } = selected ?? {};

    // Completed multi-day range → start a new one-day selection (Apply stays valid).
    if (from && to && from !== to) {
      onSelect({ from: iso, to: iso });
      return;
    }

    // Empty → provisional one-day range so Apply is immediately valid.
    if (!from) {
      onSelect({ from: iso, to: iso });
      return;
    }

    // Provisional one-day (from === to) → extend or swap into a range.
    if (iso < from) {
      onSelect({ from: iso, to: from });
      return;
    }
    onSelect({ from, to: iso });
  }

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Next month"
            disabled={!canGoNext}
            onClick={() => {
              if (!canGoNext) return;
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={title}>
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground"
            role="columnheader"
          >
            {d}
          </div>
        ))}

        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="h-9" />;
          }

          const iso = toISODate(day);
          const disabled = iso > maxIso;
          const isToday = iso === todayIso;
          const from = selected?.from;
          const to = selected?.to ?? selected?.from;
          const isStart = from === iso;
          const isEnd = !!selected?.to && selected.to === iso;
          const inRange =
            !!from && !!to && iso >= from && iso <= to && !(isStart && isEnd && from === to);
          const isSingle = !!from && from === to && from === iso;

          return (
            <div
              key={iso}
              className={cn(
                "relative flex h-9 items-center justify-center",
                inRange && !isStart && !isEnd && "bg-muted/80",
                isStart && to && from !== to && "rounded-l-md bg-muted/80",
                isEnd && from !== to && "rounded-r-md bg-muted/80"
              )}
            >
              <button
                type="button"
                role="gridcell"
                aria-selected={isStart || isEnd || isSingle}
                aria-disabled={disabled}
                disabled={disabled}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  disabled && "cursor-not-allowed text-muted-foreground/35",
                  !disabled && !isStart && !isEnd && !isSingle && "hover:bg-muted text-foreground",
                  isToday && !isStart && !isEnd && !isSingle && "font-semibold text-foreground",
                  (isStart || isEnd || isSingle) &&
                    "bg-primary text-primary-foreground hover:bg-primary-hover"
                )}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Convenience: shift a calendar month by n months. */
export function shiftMonth(month: Date, delta: number): Date {
  const base = startOfMonth(month);
  return startOfMonth(new Date(base.getFullYear(), base.getMonth() + delta, 1));
}
