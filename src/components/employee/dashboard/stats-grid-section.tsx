import { CalendarCheck, Clock, AlertCircle } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { minutesToHours } from "@/lib/utils";

export function StatsGridSection({
  presentDays,
  dayWorkedMinutes,
  shortHoursCount,
  rangeLabel,
  selectedDateLabel,
}: {
  presentDays: number;
  dayWorkedMinutes: number;
  shortHoursCount: number;
  rangeLabel: string;
  selectedDateLabel: string;
}) {
  return (
    // Deliberately not the shared `.hr-dashboard__stats` grid (via <StatsGrid>) — that
    // class is also used by /employee/attendance's own 4-card grid, and re-tuning it
    // here for this section's 3 cards would silently break that page's layout again.
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      <DashboardCard
        label="Present days"
        value={presentDays}
        hint={rangeLabel}
        icon={CalendarCheck}
        accent="green"
      />
      <DashboardCard
        label="Hours worked"
        value={minutesToHours(dayWorkedMinutes)}
        hint={selectedDateLabel}
        icon={Clock}
        accent="blue"
      />
      <DashboardCard
        label="Short hours"
        value={shortHoursCount}
        hint={rangeLabel}
        icon={AlertCircle}
        accent="amber"
      />
    </div>
  );
}
