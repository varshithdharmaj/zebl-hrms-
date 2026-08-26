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
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="payroll-period">Payroll period</Label>
          <select
            id="payroll-period"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              push({ period: e.target.value });
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {filterOptions.periods.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payroll-search">Employee</Label>
          <Input
            id="payroll-search"
            placeholder="Name or code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && push({})}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shift">Shift</Label>
          <select
            id="shift"
            value={shift}
            onChange={(e) => onShiftChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              push({ shortfall: e.target.checked ? "1" : "" });
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
              push({ ot: e.target.checked ? "1" : "" });
            }}
          />
          OT
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={late}
            onChange={(e) => {
              setLate(e.target.checked);
              push({ late: e.target.checked ? "1" : "" });
            }}
          />
          Late
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={absent}
            onChange={(e) => {
              setAbsent(e.target.checked);
              push({ absent: e.target.checked ? "1" : "" });
            }}
          />
          Absent
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pending}
            onChange={(e) => {
              setPending(e.target.checked);
              push({ pending: e.target.checked ? "1" : "" });
            }}
          />
          Pending HR decision
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => push({})}>
          Apply search
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/payroll-attendance")}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
