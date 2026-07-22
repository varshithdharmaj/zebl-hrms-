import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, startOfDay, isSameDay } from "@/lib/utils";
import { getAttendanceSettings, getDateOverridesForRange } from "@/lib/attendance/attendance-settings";
import { getHolidaysForRange, getApprovedLeaveForEmployeeRange } from "@/lib/leave/leave-calendar";
import { getEffectiveAttendanceDayType, type AttendanceDayResult } from "@/lib/attendance/day-classification";

export type AttendanceHeatmapMonth = {
  monthKey: string;
  monthLabel: string;
  prevMonthKey: string;
  nextMonthKey: string;
  days: AttendanceDayResult[];
  /** Same org-wide setting passed to the classifier for every day this month — surfaced
   *  so the UI can show "of Xh expected" without re-fetching or re-deriving it. */
  expectedWorkMinutes: number;
};

function parseMonthParam(monthStr?: string): Date {
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [year, month] = monthStr.split("-").map(Number);
    const candidate = new Date(year, month - 1, 1);
    if (!Number.isNaN(candidate.getTime())) return candidate;
  }
  return startOfMonth(new Date());
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/**
 * Fetches everything the heatmap needs for the current calendar year (Jan 1 → today)
 * in a single round-trip, then classifies every day via the canonical classifier.
 * Used for year-to-date contribution graph.
 */
export async function getEmployeeAttendanceHeatmapData(
  employeeId: number,
  monthParam?: string
): Promise<AttendanceHeatmapMonth> {
  const today = new Date();
  const currentYear = today.getFullYear();

  // Year-to-date range: January 1 of current year → today
  const startDate = new Date(currentYear, 0, 1);
  const endDate = new Date(today);

  const [records, holidays, approvedLeave, settings, overrides] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { employeeId, attendanceDate: { gte: startDate, lte: endDate } },
      orderBy: { attendanceDate: "asc" },
    }),
    getHolidaysForRange(startDate, endDate),
    getApprovedLeaveForEmployeeRange(employeeId, startDate, endDate),
    getAttendanceSettings(),
    getDateOverridesForRange(startDate, endDate),
  ]);

  const days: AttendanceDayResult[] = [];
  const currentDate = new Date(startDate);

  // Generate all days from year start to today (exclude future dates)
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

  // For compatibility with existing navigation (though arrows are now removed)
  const referenceMonth = new Date(currentYear, today.getMonth(), 1);

  return {
    monthKey: monthKey(referenceMonth),
    monthLabel: `${currentYear}`,
    prevMonthKey: monthKey(addMonths(referenceMonth, -1)),
    nextMonthKey: monthKey(addMonths(referenceMonth, 1)),
    days,
    expectedWorkMinutes: settings.expectedWorkMinutes,
  };
}
