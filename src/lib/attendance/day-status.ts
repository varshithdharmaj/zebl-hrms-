import { startOfDay, endOfDay, isSameDay } from "@/lib/utils";
import { getAttendanceSettings, getDateOverridesForRange } from "@/lib/attendance/attendance-settings";
import { getHolidaysForRange, getApprovedLeaveForEmployeeRange } from "@/lib/leave/leave-calendar";
import { getEffectiveAttendanceDayType, type AttendanceDayResult } from "@/lib/attendance/day-classification";

export type AttendanceRecordInput = {
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  remarks: string | null;
};

/**
 * Single-day variant of getEmployeeAttendanceHeatmapData — same canonical classifier,
 * same helper functions, just bounded to one date instead of a month. Pass an
 * already-fetched attendanceRecord (e.g. from getEmployeeDashboardData's dayRecord)
 * to avoid re-querying the same row.
 */
export async function getAttendanceDayStatus(params: {
  employeeId: number;
  date: Date;
  attendanceRecord?: AttendanceRecordInput | null;
}): Promise<{ day: AttendanceDayResult; expectedWorkMinutes: number }> {
  const dayStart = startOfDay(params.date);
  const dayEnd = endOfDay(params.date);

  const [holidays, approvedLeave, settings, overrides] = await Promise.all([
    getHolidaysForRange(dayStart, dayEnd),
    getApprovedLeaveForEmployeeRange(params.employeeId, dayStart, dayEnd),
    getAttendanceSettings(),
    getDateOverridesForRange(dayStart, dayEnd),
  ]);

  const holiday = holidays.find((h) => isSameDay(h.holidayDate, dayStart)) ?? null;
  const leave =
    approvedLeave.find(
      (l) => dayStart >= startOfDay(l.startDate) && dayStart <= startOfDay(l.endDate)
    ) ?? null;
  const override = overrides.find((o) => isSameDay(o.date, dayStart)) ?? null;

  const day = getEffectiveAttendanceDayType({
    date: dayStart,
    attendanceRecord: params.attendanceRecord ?? null,
    holiday: holiday ? { name: holiday.name } : null,
    approvedLeave: leave ? { leaveType: leave.leaveType } : null,
    weeklySchedule: settings,
    dateOverride: override?.type ?? null,
    expectedWorkMinutes: settings.expectedWorkMinutes,
  });

  return { day, expectedWorkMinutes: settings.expectedWorkMinutes };
}
