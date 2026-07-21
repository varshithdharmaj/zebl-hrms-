import { Suspense } from "react";
import { DashboardWelcome } from "@/components/employee/dashboard/dashboard-welcome";
import { StatsGridSection } from "@/components/employee/dashboard/stats-grid-section";
import { HistorySection } from "@/components/employee/dashboard/history-section";
import { DashboardWidgets } from "@/components/employee/dashboard/dashboard-widgets";
import { AttendanceTimeline } from "@/components/employee/attendance-timeline";
import { AttendanceHeatmap } from "@/components/employee/dashboard/attendance-heatmap";
import { getEmployeeDashboardData } from "@/lib/queries";
import { getLeaveBalanceSummaries } from "@/lib/leave";
import { getEmployeeAttendanceHeatmapData } from "@/lib/attendance/heatmap-data";
import { startOfDay } from "@/lib/utils";

export async function EmployeeDashboard({
  employeeId,
  employeeName,
  selectedDate,
  startDate,
  endDate,
  heatmapMonth,
}: {
  employeeId: number;
  employeeName: string | null;
  selectedDate?: string;
  startDate?: string;
  endDate?: string;
  heatmapMonth?: string;
}) {
  const today = startOfDay().toISOString().split("T")[0];

  const [data, balances, heatmap] = await Promise.all([
    getEmployeeDashboardData(employeeId, selectedDate, startDate, endDate),
    getLeaveBalanceSummaries(employeeId, { processAccruals: false }),
    getEmployeeAttendanceHeatmapData(employeeId, heatmapMonth),
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
            <AttendanceHeatmap month={heatmap} />
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
          employeeName={employeeName}
        />
      </aside>
    </div>
  );
}
