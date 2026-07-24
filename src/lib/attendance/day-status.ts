import { startOfDay, endOfDay, isSameDay } from "@/lib/utils";
import {
  getAttendanceSettings,
  getDateOverridesForRange,
  type AttendanceSettingsSnapshot,
} from "@/lib/attendance/attendance-settings";
import { getHolidaysForRange, getApprovedLeaveForEmployeeRange } from "@/lib/leave/leave-calendar";
import {
  getEffectiveAttendanceDayType,
  type AttendanceDayResult,
} from "@/lib/attendance/day-classification";
import type { AttendanceOverrideType } from "@/generated/prisma/client";

export type AttendanceRecordInput = {
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  remarks: string | null;
};

/** Optional preloaded calendar inputs for a day-status classification (same-request reuse). */
export type AttendanceDayCalendarContext = {
  settings: AttendanceSettingsSnapshot;
  holidays: { holidayDate: Date; name: string }[];
  approvedLeave: { leaveType: string; startDate: Date; endDate: Date }[];
  overrides: { date: Date; type: AttendanceOverrideType }[];
};

/**
 * Single-day variant of getEmployeeAttendanceHeatmapData — same canonical classifier,
 * same helper functions, just bounded to one date instead of a month. Pass an
 * already-fetched attendanceRecord (e.g. from getEmployeeDashboardData's dayRecord)
 * to avoid re-querying the same row.
 *
 * Pass `calendar` when holidays/leave/settings/overrides were already loaded for a
 * range that covers `date` (e.g. heatmap YTD) to skip the four calendar queries.
 */
export async function getAttendanceDayStatus(params: {
  employeeId: number;
  date: Date;
  attendanceRecord?: AttendanceRecordInput | null;
  calendar?: AttendanceDayCalendarContext;
}): Promise<{ day: AttendanceDayResult; expectedWorkMinutes: number }> {
  const dayStart = startOfDay(params.date);
  const dayEnd = endOfDay(params.date);

  const [holidays, approvedLeave, settings, overrides] = params.calendar
    ? [
        params.calendar.holidays,
        params.calendar.approvedLeave,
        params.calendar.settings,
        params.calendar.overrides,
      ]
    : await Promise.all([
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

/**
 * Prefer a day already classified by the heatmap (YTD) when the selected date is in range.
 * Returns null when the heatmap is missing or the date is outside its span.
 */
export function findHeatmapDayStatus(
  heatmap: { days: AttendanceDayResult[]; expectedWorkMinutes: number } | null | undefined,
  selectedDate: Date
): { day: AttendanceDayResult; expectedWorkMinutes: number } | null {
  if (!heatmap) return null;
  const dayStart = startOfDay(selectedDate);
  const day = heatmap.days.find((d) => isSameDay(d.date, dayStart)) ?? null;
  if (!day) return null;
  return { day, expectedWorkMinutes: heatmap.expectedWorkMinutes };
}
