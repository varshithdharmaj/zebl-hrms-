"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OPERATIONAL_SHIFT_FILTERS,
  isOperationalShiftFilterValue,
} from "@/lib/attendance-shift";

export function AttendanceFilters({
  defaultSearch,
  defaultDate,
  defaultPeriod = "",
  defaultShift = "",
  defaultShortfall = false,
  defaultOt = false,
  periodOptions,
}: {
  defaultSearch?: string;
  defaultDate?: string;
  defaultPeriod?: string;
  defaultShift?: string;
  defaultShortfall?: boolean;
  defaultOt?: boolean;
  periodOptions: { key: string; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(defaultSearch ?? "");
  const [date, setDate] = useState(defaultDate ?? "");
  const [period, setPeriod] = useState(defaultPeriod);
  const [shift, setShift] = useState(
    isOperationalShiftFilterValue(defaultShift) ? defaultShift : ""
  );
  const [shortfall, setShortfall] = useState(defaultShortfall);
  const [ot, setOt] = useState(defaultOt);

  const pushWithParams = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      p.delete("page");

      const q = overrides.q ?? search;
      const d = overrides.date ?? date;
      const per = overrides.period ?? period;
      const s = overrides.shift ?? shift;

      if (q) p.set("q", q);
      else p.delete("q");
      if (per) {
        p.set("period", per);
        p.delete("date");
      } else {
        p.delete("period");
        if (d) p.set("date", d);
        else p.delete("date");
      }
      if (s) p.set("shift", s);
      else p.delete("shift");
      if (overrides.shortfall === "1" || (overrides.shortfall === undefined && shortfall)) {
        p.set("shortfall", "1");
      } else {
        p.delete("shortfall");
      }
      if (overrides.ot === "1" || (overrides.ot === undefined && ot)) {
        p.set("ot", "1");
      } else {
        p.delete("ot");
      }

      const qs = p.toString();
      router.push(qs ? `/admin/attendance?${qs}` : "/admin/attendance");
    },
    [router, searchParams, search, date, period, shift, shortfall, ot]
  );

  function apply() {
    pushWithParams({});
  }

  function clear() {
    setSearch("");
    setDate("");
    setPeriod("");
    setShift("");
    setShortfall(false);
    setOt(false);
    router.push("/admin/attendance");
  }

  function onShiftChange(next: string) {
    const value = isOperationalShiftFilterValue(next) ? next : "";
    setShift(value);
    pushWithParams({ shift: value });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor="search" className="text-xs font-semibold text-slate-700">Employee</Label>
          <Input
            id="search"
            placeholder="Search name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="h-9 text-xs"
          />
        </div>
        <div className="min-w-[10rem] space-y-1">
          <Label htmlFor="period" className="text-xs font-semibold text-slate-700">Payroll period</Label>
          <select
            id="period"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              if (e.target.value) setDate("");
              pushWithParams({ period: e.target.value, date: e.target.value ? "" : date });
            }}
            className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-xs font-medium text-slate-900 shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            <option value="">Any date / single day</option>
            {periodOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="date" className="text-xs font-semibold text-slate-700">Single day</Label>
          <Input
            id="date"
            type="date"
            value={date}
            disabled={Boolean(period)}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <div className="min-w-[10rem] space-y-1">
          <Label htmlFor="shift" className="text-xs font-semibold text-slate-700">Shift</Label>
          <select
            id="shift"
            value={shift}
            onChange={(e) => onShiftChange(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-xs font-medium text-slate-900 shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            {OPERATIONAL_SHIFT_FILTERS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/60">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={shortfall}
              onChange={(e) => {
                setShortfall(e.target.checked);
                pushWithParams({ shortfall: e.target.checked ? "1" : "" });
              }}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            Shortfall only
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ot}
              onChange={(e) => {
                setOt(e.target.checked);
                pushWithParams({ ot: e.target.checked ? "1" : "" });
              }}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            Overtime only
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={apply}>
            Filter
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
