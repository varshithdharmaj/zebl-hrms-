import { AttendanceHero } from "@/components/employee/dashboard/attendance-hero";
import { StatsGridSection } from "@/components/employee/dashboard/stats-grid-section";
import { HistorySection } from "@/components/employee/dashboard/history-section";
import { DashboardWidgets } from "@/components/employee/dashboard/dashboard-widgets";
import { AttendanceTimeline } from "@/components/employee/attendance-timeline";
import { AttendanceHeatmap } from "@/components/employee/dashboard/attendance-heatmap";
import { getEmployeeDashboardData } from "@/lib/queries";
import { getLeaveBalanceSummaries } from "@/lib/leave";
import { getEmployeeAttendanceHeatmapData, type AttendanceHeatmapMonth } from "@/lib/attendance/heatmap-data";
import { getAttendanceDayStatus } from "@/lib/attendance/day-status";
import { getHeroStatus, type HeroStatus } from "@/lib/attendance/hero-status";
import { startOfDay, toISODate } from "@/lib/utils";

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
    // Isolated so a heatmap-only failure doesn't take down the rest of an already-fetched
    // dashboard (Hero, KPIs, history below all render fine independently of this).
    getEmployeeAttendanceHeatmapData(employeeId, heatmapMonth).catch(
      (e): AttendanceHeatmapMonth | null => {
        console.error("[employee-dashboard] heatmap failed:", e);
        return null;
      }
    ),
  ]);

  const isToday = data.selectedDate === toISODate(startOfDay());

  // Scoped resilience: if the richer classification fails, the rest of the dashboard
  // (KPIs, heatmap, history, leave balances — already resolved above) still renders.
  // The hero and the detailed attendance card both fall back to their own inline
  // error notices rather than taking down the whole page.
  let heroStatus: HeroStatus | null = null;
  let expectedWorkMinutes: number | null = null;
  try {
    const result = await getAttendanceDayStatus({
      employeeId,
      date: new Date(data.selectedDate + "T00:00:00"),
      attendanceRecord: {
        checkIn: data.day.checkIn,
        checkOut: data.day.checkOut,
        workedMinutes: data.day.workedMinutes,
        overtimeMinutes: data.day.overtimeMinutes,
        remarks: data.day.remarks,
      },
    });
    expectedWorkMinutes = result.expectedWorkMinutes;
    heroStatus = getHeroStatus(result.day, { isToday, expectedWorkMinutes });
  } catch (e) {
    console.error("[employee-dashboard] hero status failed:", e);
  }

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
        {/* A. Header / today's status + the one authoritative filter control */}
        <AttendanceHero
          firstName={firstName}
          fullName={employeeName}
          displayDate={displayDate}
          dateIso={data.selectedDate}
          heroStatus={heroStatus}
          defaultDate={today}
          defaultStart={data.selectedStart}
          defaultEnd={data.selectedEnd}
        />

        {/* C. Today's attendance */}
        <AttendanceTimeline
          heroStatus={heroStatus}
          overtimeMinutes={data.day.overtimeMinutes}
          expectedWorkMinutes={expectedWorkMinutes}
          isToday={isToday}
          selectedDateLabel={selectedDayLabel}
        />

        {/* D. Core KPI summary */}
        <StatsGridSection
          presentDays={data.period.presentDays}
          dayWorkedMinutes={data.day.workedMinutes}
          shortHoursCount={data.period.shortHoursCount}
          rangeLabel={data.period.rangeLabel}
          selectedDateLabel={selectedDayLabel}
        />

        {/* E. Attendance heatmap */}
        <AttendanceHeatmap month={heatmap} />

        {/* F. Attendance history */}
        <HistorySection rangeLabel={data.period.rangeLabel} records={data.recentRecords} />
      </div>

      <aside className="hr-dashboard__rail">
        {/* G. Leave / upcoming information */}
        <DashboardWidgets balances={balances} />
      </aside>
    </div>
  );
}
