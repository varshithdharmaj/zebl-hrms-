import { getHolidaysForRange, getApprovedLeaveForEmployeeRange } from "@/lib/leave/leave-calendar";
import { getAttendanceSettings, getDateOverridesForRange } from "@/lib/attendance/attendance-settings";
import { getEffectiveAttendanceDayType, type AttendanceDayCategory, type AttendanceRatioTier } from "@/lib/attendance/day-classification";
import { hasRemarkKeyword } from "@/lib/attendance/hero-status";
import { isSameDay, startOfDay } from "@/lib/utils";

export type AttendanceHistoryRecordInput = {
  id: number;
  attendanceDate: Date;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  remarks: string | null;
  /** Raw upload-time status, kept only for callers still on the legacy field (e.g. the
   *  admin employee-profile attendance tab) — not used by the canonical classification
   *  below. New consumers should read `category`/`ratioTier` instead. */
  status: string;
};

export type ClassifiedAttendanceRecord = AttendanceHistoryRecordInput & {
  category: AttendanceDayCategory;
  ratioTier: AttendanceRatioTier | null;
  expectedWorkMinutes: number;
  late: boolean;
  earlyCheckout: boolean;
  hasLeaveConflict: boolean;
};

/**
 * Re-classifies existing attendance rows with the same canonical classifier the Hero,
 * Timeline, and Heatmap already use — instead of the raw upload-time `status` string
 * (Present/Absent/Short Hours only), which has no concept of leave/holiday/weekly-off
 * and so mislabels those days (e.g. an approved-leave day with no punch reads as
 * "Absent"). Only 3 extra range-bounded lookups (holidays/leave/overrides); settings is
 * request-memoized via React's cache() so a second call here is free.
 */
export async function classifyAttendanceRecords(
  employeeId: number,
  records: AttendanceHistoryRecordInput[],
  rangeStart: Date,
  rangeEnd: Date
): Promise<ClassifiedAttendanceRecord[]> {
  if (records.length === 0) return [];

  const [holidays, approvedLeave, settings, overrides] = await Promise.all([
    getHolidaysForRange(rangeStart, rangeEnd),
    getApprovedLeaveForEmployeeRange(employeeId, rangeStart, rangeEnd),
    getAttendanceSettings(),
    getDateOverridesForRange(rangeStart, rangeEnd),
  ]);

  return records.map((record) => {
    const date = startOfDay(record.attendanceDate);
    const holiday = holidays.find((h) => isSameDay(h.holidayDate, date)) ?? null;
    const leave =
      approvedLeave.find((l) => date >= startOfDay(l.startDate) && date <= startOfDay(l.endDate)) ?? null;
    const override = overrides.find((o) => isSameDay(o.date, date)) ?? null;

    const day = getEffectiveAttendanceDayType({
      date,
      attendanceRecord: {
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        workedMinutes: record.workedMinutes,
        overtimeMinutes: record.overtimeMinutes,
        remarks: record.remarks,
      },
      holiday: holiday ? { name: holiday.name } : null,
      approvedLeave: leave ? { leaveType: leave.leaveType } : null,
      weeklySchedule: settings,
      dateOverride: override?.type ?? null,
      expectedWorkMinutes: settings.expectedWorkMinutes,
    });

    return {
      ...record,
      category: day.category,
      ratioTier: day.ratioTier,
      expectedWorkMinutes: settings.expectedWorkMinutes,
      late: hasRemarkKeyword(day.remark, "late"),
      earlyCheckout: hasRemarkKeyword(day.remark, "early"),
      hasLeaveConflict: day.hasLeaveConflict,
    };
  });
}

/** Tight bound for callers with no explicit date filter (e.g. unfiltered pagination) —
 *  avoids fetching holiday/leave/override data for a wider span than the page actually needs. */
export function dateSpanOf(records: { attendanceDate: Date }[]): { start: Date; end: Date } {
  const times = records.map((r) => r.attendanceDate.getTime());
  return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
}
