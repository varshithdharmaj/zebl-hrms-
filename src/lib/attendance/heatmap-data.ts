import { startOfDay, isSameDay } from "@/lib/utils";
import { getAttendanceSettings, getDateOverridesForRange } from "@/lib/attendance/attendance-settings";
import { getHolidaysForRange, getApprovedLeaveForEmployeeRange } from "@/lib/leave/leave-calendar";
import { getEmployeeAttendanceRecordsForRange } from "@/lib/attendance/employee-attendance-year-cache";
import { getEffectiveAttendanceDayType, type AttendanceDayResult } from "@/lib/attendance/day-classification";
import { getAttendanceCycleWindow } from "@/lib/attendance/attendance-cycle";
import { resolveHeatmapStartDate } from "@/lib/attendance/heatmap-start-date";

export type AttendanceHeatmapMonth = {
  monthKey: string;
  monthLabel: string;
  prevMonthKey: string;
  nextMonthKey: string;
  days: AttendanceDayResult[];
  /** Same org-wide setting passed to the classifier for every day this month — surfaced
   *  so the UI can show "of Xh expected" without re-fetching or re-deriving it. */
  expectedWorkMinutes: number;
  /** The active 25th-to-25th attendance cycle containing today — the heatmap highlights
   *  this as a band over the full year view (see AttendanceHeatmap's cycle overlay). */
  cycleStartDate: Date;
  cycleEndDate: Date;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/**
 * Fetches everything the heatmap needs for the year-to-date contribution graph, then
 * classifies every day via the canonical classifier. The lower bound is the fixed
 * `HEATMAP_DISPLAY_START_DATE` for every employee, regardless of joining date (see
 * `resolveHeatmapStartDate`).
 * The cycle is still computed (`getAttendanceCycleWindow`) and surfaced via
 * `cycleStartDate`/`cycleEndDate` so the UI can highlight it as a band over the visible
 * range, independent of where that range starts.
 *
 * The fetch range's tail extends past today only far enough to cover the active cycle's
 * remaining days (so the heatmap can render them "upcoming" instead of just omitting
 * them) — never further, so this stays a small, bounded addition to year-to-date.
 *
 * `monthParam` is accepted for call-site/back-compat only — month navigation was
 * already removed from the UI before the cycle-window work.
 */
export async function getEmployeeAttendanceHeatmapData(
  employeeId: number,
  monthParam?: string
): Promise<AttendanceHeatmapMonth> {
  void monthParam;
  const today = startOfDay(new Date());
  const currentYear = today.getFullYear();
  const cycleWindow = getAttendanceCycleWindow(today);

  const startDate = resolveHeatmapStartDate(today);
  const endDate = cycleWindow.endDate > today ? cycleWindow.endDate : today;

  // endDate is inclusive. Year-cache API uses exclusive end — add one day.
  const endExclusive = startOfDay(
    new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1)
  );

  const [records, holidays, approvedLeave, settings, overrides] = await Promise.all([
    getEmployeeAttendanceRecordsForRange(employeeId, startDate, endExclusive),
    getHolidaysForRange(startDate, endDate),
    getApprovedLeaveForEmployeeRange(employeeId, startDate, endDate),
    getAttendanceSettings(),
    getDateOverridesForRange(startDate, endDate),
  ]);

  const days: AttendanceDayResult[] = [];
  const currentDate = new Date(startDate);

  // Generate every day from the start of the year through endDate (which may extend a
  // few days past today to cover the active cycle's tail) — the classifier only sees
  // date/schedule/holiday/leave/record inputs, so future dates with no attendance
  // record simply classify the same way "no data yet" always has.
  while (currentDate <= endDate) {
    const date = new Date(currentDate);

    const attendanceRecord = records.find((r) => isSameDay(r.attendanceDate, date)) ?? null;
    const holiday = holidays.find((h) => isSameDay(h.holidayDate, date)) ?? null;
    const leave =
      approvedLeave.find((l) => date >= startOfDay(l.startDate) && date <= startOfDay(l.endDate)) ??
      null;
    const override = overrides.find((o) => isSameDay(o.date, date)) ?? null;

    days.push(
      getEffectiveAttendanceDayType({
        date,
        attendanceRecord: attendanceRecord
          ? {
            checkIn: attendanceRecord.checkIn,
            checkOut: attendanceRecord.checkOut,
            workedMinutes: attendanceRecord.workedMinutes,
            overtimeMinutes: attendanceRecord.overtimeMinutes,
            remarks: attendanceRecord.remarks,
          }
          : null,
        holiday: holiday ? { name: holiday.name } : null,
        approvedLeave: leave ? { leaveType: leave.leaveType } : null,
        weeklySchedule: settings,
        dateOverride: override?.type ?? null,
        expectedWorkMinutes: settings.expectedWorkMinutes,
      })
    );

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const referenceMonth = new Date(currentYear, today.getMonth(), 1);

  return {
    monthKey: monthKey(referenceMonth),
    monthLabel: `${currentYear}`,
    prevMonthKey: monthKey(addMonths(referenceMonth, -1)),
    nextMonthKey: monthKey(addMonths(referenceMonth, 1)),
    days,
    expectedWorkMinutes: settings.expectedWorkMinutes,
    cycleStartDate: cycleWindow.startDate,
    cycleEndDate: cycleWindow.endDate,
  };
}
