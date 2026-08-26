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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <Label htmlFor="search">Employee</Label>
          <Input
            id="search"
            placeholder="Name or code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
          />
        </div>
        <div className="min-w-[10rem] space-y-1.5">
          <Label htmlFor="period">Payroll period</Label>
          <select
            id="period"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              if (e.target.value) setDate("");
              pushWithParams({ period: e.target.value, date: e.target.value ? "" : date });
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Any date / single day</option>
            {periodOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Single day</Label>
          <Input
            id="date"
            type="date"
            value={date}
            disabled={Boolean(period)}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="min-w-[10rem] space-y-1.5">
          <Label htmlFor="shift">Shift</Label>
          <select
            id="shift"
            value={shift}
            onChange={(e) => onShiftChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {OPERATIONAL_SHIFT_FILTERS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shortfall}
            onChange={(e) => {
              setShortfall(e.target.checked);
              pushWithParams({ shortfall: e.target.checked ? "1" : "" });
            }}
          />
          Shortfall
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ot}
            onChange={(e) => {
              setOt(e.target.checked);
              pushWithParams({ ot: e.target.checked ? "1" : "" });
            }}
          />
          OT
        </label>
      </div>

      <div className="flex gap-2 pb-0.5">
        <Button type="button" onClick={apply}>
          Apply
        </Button>
        <Button type="button" variant="outline" onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
