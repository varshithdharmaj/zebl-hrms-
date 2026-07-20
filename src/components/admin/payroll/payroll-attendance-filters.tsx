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

type FilterOptions = {
  periods: { key: string; label: string }[];
};

export function PayrollAttendanceFilters({
  defaultPeriod,
  defaultSearch,
  filterOptions,
  defaults,
}: {
  defaultPeriod: string;
  defaultSearch?: string;
  filterOptions: FilterOptions;
  defaults: {
    shift?: string;
    shortfall?: boolean;
    ot?: boolean;
    late?: boolean;
    absent?: boolean;
    pending?: boolean;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(defaultSearch ?? "");
  const [period, setPeriod] = useState(defaultPeriod);
  const [shift, setShift] = useState(
    isOperationalShiftFilterValue(defaults.shift) ? defaults.shift! : ""
  );
  const [shortfall, setShortfall] = useState(defaults.shortfall ?? false);
  const [ot, setOt] = useState(defaults.ot ?? false);
  const [late, setLate] = useState(defaults.late ?? false);
  const [absent, setAbsent] = useState(defaults.absent ?? false);
  const [pending, setPending] = useState(defaults.pending ?? false);

  const push = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      const values = {
        period,
        q: search,
        shift,
        shortfall: shortfall ? "1" : "",
        ot: ot ? "1" : "",
        late: late ? "1" : "",
        absent: absent ? "1" : "",
        pending: pending ? "1" : "",
        ...overrides,
      };

      for (const [key, val] of Object.entries(values)) {
        if (val === "1") p.set(key, "1");
        else if (val && val.length > 0) p.set(key, val);
        else p.delete(key);
      }

      router.push(`/admin/payroll-attendance?${p.toString()}`);
    },
    [router, searchParams, period, search, shift, shortfall, ot, late, absent, pending]
  );

  function onShiftChange(next: string) {
    const value = isOperationalShiftFilterValue(next) ? next : "";
    setShift(value);
    push({ shift: value });
  }

  return (
    <div className="space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="payroll-period" className="text-xs font-semibold text-slate-700">Payroll period</Label>
          <select
            id="payroll-period"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              push({ period: e.target.value });
            }}
            className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-xs font-medium text-slate-900 shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            {filterOptions.periods.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="payroll-search" className="text-xs font-semibold text-slate-700">Employee</Label>
          <Input
            id="payroll-search"
            placeholder="Name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && push({})}
            className="h-9 text-xs"
          />
        </div>
        <div className="space-y-1">
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
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={shortfall}
              onChange={(e) => {
                setShortfall(e.target.checked);
                push({ shortfall: e.target.checked ? "1" : "" });
              }}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            Shortfall
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ot}
              onChange={(e) => {
                setOt(e.target.checked);
                push({ ot: e.target.checked ? "1" : "" });
              }}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            Overtime
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={late}
              onChange={(e) => {
                setLate(e.target.checked);
                push({ late: e.target.checked ? "1" : "" });
              }}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            Late
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={absent}
              onChange={(e) => {
                setAbsent(e.target.checked);
                push({ absent: e.target.checked ? "1" : "" });
              }}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            Absent
          </label>
          <label className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pending}
              onChange={(e) => {
                setPending(e.target.checked);
                push({ pending: e.target.checked ? "1" : "" });
              }}
              className="h-4 w-4 rounded border-amber-400 text-amber-800 focus:ring-amber-400"
            />
            Pending HR Decision
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => push({})}>
            Filter
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/payroll-attendance")}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
