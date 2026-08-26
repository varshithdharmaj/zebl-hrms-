"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DateRangeFilter } from "@/components/ui/date-range-filter";

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

  function pushDate(value: string | null) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set("date", value);
    else p.delete("date");
    router.push(`${pathname}?${p.toString()}`);
  }

  const dateInputClass =
    "h-10 rounded-xl border border-input bg-card px-3 text-sm shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40";

  if (layout === "compact") {
    return (
      <div className="space-y-4">
        {showDayPicker && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">View day</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => pushDate(e.target.value)}
                className={`${dateInputClass} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => pushDate(null)}
                className="shrink-0 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Today
              </button>
            </div>
          </div>
        )}
        {showRange && (
          <DateRangeFilter
            defaultStart={defaultStart}
            defaultEnd={defaultEnd}
            layout="compact"
          />
        )}
      </div>
    );
  }

  if (layout === "inline") {
    return showRange ? (
      <DateRangeFilter
        defaultStart={defaultStart}
        defaultEnd={defaultEnd}
        layout="inline"
      />
    ) : null;
  }

  return (
    <div className="flex flex-col gap-4">
      {showDayPicker && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">View day</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => pushDate(e.target.value)}
              className={dateInputClass}
            />
            <button
              type="button"
              onClick={() => pushDate(null)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Today
            </button>
          </div>
        </div>
      )}
      {showRange && (
        <DateRangeFilter defaultStart={defaultStart} defaultEnd={defaultEnd} layout="default" />
      )}
    </div>
  );
}
