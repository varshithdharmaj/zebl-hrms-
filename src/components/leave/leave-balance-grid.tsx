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
            className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-card"
          >
            <div className="border-b border-border bg-muted/30 px-5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{LEAVE_TYPE_LABELS[type]}</p>
                <span className="rounded-md bg-card px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground shadow-subtle">
                  {item.leaveType}
                </span>
              </div>
            </div>
            <div className="p-5">
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {formatLeaveDays(item.remaining)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="tabular-nums">{formatLeaveDays(item.used)}</span> used ·{" "}
                <span className="tabular-nums">{formatLeaveDays(item.total)}</span> total
              </p>
              {item.note && (
                <p className="mt-3 rounded-lg bg-warning-muted px-2 py-1 text-xs text-warning">
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
