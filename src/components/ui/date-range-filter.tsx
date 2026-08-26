"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { toISODate, startOfDay, startOfMonth } from "@/lib/utils";

type Preset = { id: string; label: string; start: string; end: string };

export function DateRangeFilter({
  defaultStart,
  defaultEnd,
  startParam = "start",
  endParam = "end",
  layout = "default",
  showPresets = true,
}: {
  defaultStart: string;
  defaultEnd: string;
  startParam?: string;
  endParam?: string;
  layout?: "default" | "compact" | "inline";
  showPresets?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const start = searchParams.get(startParam) ?? defaultStart;
  const end = searchParams.get(endParam) ?? defaultEnd;
  const presets = getPresets();

  function push(updates: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString());
    const affectsRange = startParam in updates || endParam in updates;
    Object.entries(updates).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (affectsRange) p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  function applyPreset(preset: Preset) {
    push({ [startParam]: preset.start, [endParam]: preset.end, page: null });
  }

  const isActivePreset = (p: Preset) => p.start === start && p.end === end;

  const dateInputClass =
    "h-10 rounded-xl border border-input bg-card px-3 text-sm shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40";

  const fields = (
    <>
      <FilterField label="Start date">
        <input
          type="date"
          value={start}
          max={end}
          onChange={(e) => {
            const next = e.target.value;
            if (next && end && next > end) {
              push({ [startParam]: next, [endParam]: next });
            } else {
              push({ [startParam]: next });
            }
          }}
          className={cn(dateInputClass, layout === "inline" ? "w-[9.5rem]" : "w-full min-w-0")}
        />
      </FilterField>
      <FilterField label="End date">
        <input
          type="date"
          value={end}
          min={start}
          onChange={(e) => {
            const next = e.target.value;
            if (next && start && next < start) {
              push({ [startParam]: next, [endParam]: next });
            } else {
              push({ [endParam]: next });
            }
          }}
          className={cn(dateInputClass, layout === "inline" ? "w-[9.5rem]" : "w-full min-w-0")}
        />
      </FilterField>
    </>
  );

  const presetRow = showPresets && (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick date ranges">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => applyPreset(p)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            isActivePreset(p)
              ? "bg-primary text-primary-foreground shadow-subtle"
              : "bg-muted text-muted-foreground hover:bg-card hover:shadow-subtle"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  if (layout === "compact") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">{fields}</div>
        {presetRow}
      </div>
    );
  }

  if (layout === "inline") {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="date"
          value={start}
          max={end}
          aria-label="Start date"
          onChange={(e) => push({ [startParam]: e.target.value })}
          className={dateInputClass}
        />
        <span className="pb-2 text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={end}
          min={start}
          aria-label="End date"
          onChange={(e) => push({ [endParam]: e.target.value })}
          className={dateInputClass}
        />
        {showPresets && presets.slice(0, 3).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              isActivePreset(p)
                ? "bg-foreground text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">{fields}</div>
      {presetRow}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[9.5rem] flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

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
