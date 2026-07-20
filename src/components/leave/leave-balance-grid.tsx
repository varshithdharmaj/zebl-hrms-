import { LEAVE_TYPE_LABELS, formatLeaveDays, type LeaveType } from "@/lib/leave-types";
import type { LeaveBalanceSummary } from "@/lib/leave";

export function LeaveBalanceGrid({ balances }: { balances: LeaveBalanceSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {balances.map((item) => {
        const type = item.leaveType as LeaveType;
        return (
          <div
            key={item.leaveType}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-subtle"
          >
            <div className="border-b border-border bg-slate-50/70 px-5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{LEAVE_TYPE_LABELS[type]}</p>
                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[0.6875rem] font-bold text-slate-700 shadow-subtle">
                  {item.leaveType}
                </span>
              </div>
            </div>
            <div className="p-5">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                {formatLeaveDays(item.remaining)}
              </p>
              <p className="mt-1.5 text-xs font-medium text-slate-500">
                <span className="tabular-nums font-semibold text-slate-700">{formatLeaveDays(item.used)}</span> used ·{" "}
                <span className="tabular-nums font-semibold text-slate-700">{formatLeaveDays(item.total)}</span> total
              </p>
              {item.note && (
                <p className="mt-3 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-600/20">
                  {item.note}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
