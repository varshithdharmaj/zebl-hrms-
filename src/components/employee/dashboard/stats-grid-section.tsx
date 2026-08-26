import {
  Clock,
  CalendarCheck,
  Timer,
  AlertCircle,
  Palmtree,
} from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatsGrid } from "@/components/ui/stats-grid";
import { formatLeaveDays } from "@/lib/leave-types";
import type { LeaveBalanceSummary } from "@/lib/leave";
import { minutesToHours } from "@/lib/utils";

export function StatsGridSection({
  workedMinutes,
  presentDays,
  overtimeMinutes,
  shortHoursCount,
  rangeLabel,
  balances,
}: {
  workedMinutes: number;
  presentDays: number;
  overtimeMinutes: number;
  shortHoursCount: number;
  rangeLabel: string;
  balances: LeaveBalanceSummary[];
}) {
  const el = balances.find((b) => b.leaveType === "EL");
  const cl = balances.find((b) => b.leaveType === "CL");
  const sl = balances.find((b) => b.leaveType === "SL");

  return (
    <StatsGrid>
      <DashboardCard
        label="Today worked"
        value={minutesToHours(workedMinutes)}
        hint="Selected day"
        icon={Clock}
        accent="blue"
      />
      <DashboardCard
        label="Present days"
        value={presentDays}
        hint={rangeLabel}
        icon={CalendarCheck}
        accent="green"
      />
      <DashboardCard
        label="Overtime"
        value={minutesToHours(overtimeMinutes)}
        hint="In range"
        icon={Timer}
        accent="violet"
      />
      <DashboardCard
        label="Short hours"
        value={shortHoursCount}
        hint="In range"
        icon={AlertCircle}
        accent="amber"
      />
      <DashboardCard label="Leave balance" icon={Palmtree} accent="teal" className="sm:col-span-2 lg:col-span-1">
        <ul className="space-y-2.5">
          {[
            { key: "EL", val: el?.remaining ?? 0 },
            { key: "CL", val: cl?.remaining ?? 0 },
            { key: "SL", val: sl?.remaining ?? 0 },
          ].map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-muted-foreground">{row.key}</span>
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {formatLeaveDays(row.val)}
              </span>
            </li>
          ))}
        </ul>
      </DashboardCard>
    </StatsGrid>
  );
}
