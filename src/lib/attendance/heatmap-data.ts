import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, startOfDay, toISODate } from "@/lib/utils";
import { getAttendanceSettings, getDateOverridesForRange } from "@/lib/attendance/attendance-settings";
import { getHolidaysForRange, getApprovedLeaveForEmployeeRange } from "@/lib/leave/leave-calendar";
import { getEffectiveAttendanceDayType, type AttendanceDayResult } from "@/lib/attendance/day-classification";

export type AttendanceHeatmapMonth = {
  monthKey: string;
  monthLabel: string;
  prevMonthKey: string;
  nextMonthKey: string;
  days: AttendanceDayResult[];
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

function isSameDay(a: Date, b: Date): boolean {
  return toISODate(startOfDay(a)) === toISODate(startOfDay(b));
}

/**
 * Fetches everything the heatmap needs for one calendar month in a single bounded
 * round-trip pair (Promise.all, no per-day queries), then classifies every day via
 * the canonical getEffectiveAttendanceDayType(). Scoped to one employee only —
 * callers must pass session.employeeId, never an arbitrary id from the client.
 */
export async function getEmployeeAttendanceHeatmapData(
  employeeId: number,
  monthParam?: string
): Promise<AttendanceHeatmapMonth> {
  const monthStart = parseMonthParam(monthParam);
  const monthEnd = endOfMonth(monthStart);

  const [records, holidays, approvedLeave, settings, overrides] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { employeeId, attendanceDate: { gte: monthStart, lte: monthEnd } },
      orderBy: { attendanceDate: "asc" },
    }),
    getHolidaysForRange(monthStart, monthEnd),
    getApprovedLeaveForEmployeeRange(employeeId, monthStart, monthEnd),
    getAttendanceSettings(),
    getDateOverridesForRange(monthStart, monthEnd),
  ]);

  const days: AttendanceDayResult[] = [];
  const totalDays = monthEnd.getDate();

  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNum);

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
  }

  return {
    monthKey: monthKey(monthStart),
    monthLabel: monthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    prevMonthKey: monthKey(addMonths(monthStart, -1)),
    nextMonthKey: monthKey(addMonths(monthStart, 1)),
    days,
  };
}
