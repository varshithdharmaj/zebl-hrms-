import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { WidgetCard } from "@/components/ui/widget-card";
import { Button } from "@/components/ui/button";
import { formatLeaveDays, LEAVE_TYPE_LABELS, type LeaveType } from "@/lib/leave-types";
import type { LeaveBalanceSummary } from "@/lib/leave";
import { cn } from "@/lib/utils";

const leaveAccent: Record<LeaveType, string> = {
  EL: "text-accent-green",
  CL: "text-accent-blue",
  SL: "text-accent-amber",
};

export function DashboardWidgets({ balances }: { balances: LeaveBalanceSummary[] }) {
  return (
    <WidgetCard title="Leave balances" description="Remaining days">
      <ul className="space-y-3">
        {balances.map((b) => {
          const type = b.leaveType as LeaveType;
          return (
            <li
              key={b.leaveType}
              className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5"
            >
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {LEAVE_TYPE_LABELS[type]}
                </p>
                <p className={cn("text-lg font-semibold tabular-nums", leaveAccent[type])}>
                  {formatLeaveDays(b.remaining)}
                </p>
              </div>
              <span className="rounded-md bg-card px-2 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground shadow-subtle">
                {b.leaveType}
              </span>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
        <Link href="/employee/leaves">
          Request leave
          <CalendarPlus className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </WidgetCard>
  );
}
