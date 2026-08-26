import { AlertCircle, Clock, Timer, Users, Wallet } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { formatMinutesAsHours } from "@/lib/payroll/payroll-display";

export function PayrollSummaryCards({
  cards,
}: {
  cards: {
    totalEmployees: number;
    totalOtMinutes: number;
    totalShortfallMinutes: number;
    pendingHrDecisions: number;
    employeesWithDeductions: number;
  };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <DashboardCard
        label="Total Employees"
        value={cards.totalEmployees}
        icon={Users}
        accent="blue"
      />
      <DashboardCard
        label="Total OT Hours"
        value={formatMinutesAsHours(cards.totalOtMinutes)}
        icon={Timer}
        accent="green"
      />
      <DashboardCard
        label="Total Shortfall Hours"
        value={formatMinutesAsHours(cards.totalShortfallMinutes)}
        icon={Clock}
        accent="amber"
      />
      <DashboardCard
        label="Pending HR Decisions"
        value={cards.pendingHrDecisions}
        hint="Shortfall with no action recorded"
        icon={AlertCircle}
        accent="amber"
      />
      <DashboardCard
        label="Employees With Deductions"
        value={cards.employeesWithDeductions}
        hint="Leave or salary deduction decisions"
        icon={Wallet}
        accent="violet"
      />
    </div>
  );
}
