import { Suspense } from "react";
import { DashboardWelcome } from "@/components/employee/dashboard/dashboard-welcome";
import { StatsGridSection } from "@/components/employee/dashboard/stats-grid-section";
import { HistorySection } from "@/components/employee/dashboard/history-section";
import { DashboardWidgets } from "@/components/employee/dashboard/dashboard-widgets";
import { AttendanceTimeline } from "@/components/employee/attendance-timeline";
import { ChartCard } from "@/components/ui/chart-card";
import { getEmployeeDashboardData } from "@/lib/queries";
import { getLeaveBalanceSummaries } from "@/lib/leave";
import { startOfDay } from "@/lib/utils";

export async function EmployeeDashboard({
  employeeId,
  employeeName,
  selectedDate,
  startDate,
  endDate,
}: {
  employeeId: number;
  employeeName: string | null;
  selectedDate?: string;
  startDate?: string;
  endDate?: string;
}) {
  const today = startOfDay().toISOString().split("T")[0];

  const [data, balances] = await Promise.all([
    getEmployeeDashboardData(employeeId, selectedDate, startDate, endDate),
    getLeaveBalanceSummaries(employeeId, { processAccruals: false }),
  ]);

  const firstName = employeeName?.split(" ")[0] ?? "there";
  const displayDate = new Date(data.selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const selectedDayLabel = new Date(data.selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="hr-dashboard">
      <div className="hr-dashboard__main">
        <DashboardWelcome
          firstName={firstName}
          fullName={employeeName}
          displayDate={displayDate}
          dateIso={data.selectedDate}
          status={data.day.status}
          workedMinutes={data.day.workedMinutes}
          presentDays={data.period.presentDays}
          attendancePercent={data.period.attendancePercent}
          rangeLabel={data.period.rangeLabel}
          defaultDate={today}
          defaultStart={data.selectedStart}
          defaultEnd={data.selectedEnd}
        />

        <StatsGridSection
          workedMinutes={data.day.workedMinutes}
          presentDays={data.period.presentDays}
          overtimeMinutes={data.period.overtimeMinutes}
          shortHoursCount={data.period.shortHoursCount}
          rangeLabel={data.period.rangeLabel}
          balances={balances}
        />

        <div className="hr-dashboard__analytics">
          <AttendanceTimeline
            checkIn={data.day.checkIn}
            checkOut={data.day.checkOut}
            workedMinutes={data.day.workedMinutes}
            overtimeMinutes={data.day.overtimeMinutes}
            status={data.day.status}
            selectedDateLabel={selectedDayLabel}
          />
          <Suspense fallback={null}>
            <ChartCard
              title="Attendance trend"
              description={data.period.rangeLabel}
              records={data.periodRecords}
            />
          </Suspense>
        </div>

        <HistorySection
          rangeLabel={data.period.rangeLabel}
          records={data.recentRecords}
          defaultDate={today}
          defaultStart={data.selectedStart}
          defaultEnd={data.selectedEnd}
        />
      </div>

      <aside className="hr-dashboard__rail">
        <DashboardWidgets
          balances={balances}
          attendancePercent={data.period.attendancePercent}
          presentDays={data.period.presentDays}
          overtimeMinutes={data.period.overtimeMinutes}
          rangeLabel={data.period.rangeLabel}
          employeeName={employeeName}
        />
      </aside>
    </div>
  );
}
