import {
  isWorkedDayCategory,
  isShortHoursTier,
  isTargetOrBetterTier,
} from "@/lib/attendance/day-classification";
import type { ClassifiedAttendanceRecord } from "@/lib/attendance/history-classification";

export type AttendanceRangeAggregate = {
  workingDays: number;
  presentDays: number;
  shortHoursCount: number;
  insufficientDataCount: number;
  overtimeMinutes: number;
  attendancePercent: number;
};

/**
 * Numeric KPI aggregation over a set of already-classified attendance rows (see
 * classifyAttendanceRecords) — deliberately separate from the classifier itself, which
 * answers a different question. Present/Short Hours are read off the same canonical
 * category + ratio tier the Hero/Timeline/Heatmap/History already use, not the raw
 * upload-time `status` string, which has no concept of leave/holiday/weekly-off and
 * folds missing-checkout data-quality issues into "Short Hours".
 */
export function aggregateAttendanceForRange(
  records: ClassifiedAttendanceRecord[]
): AttendanceRangeAggregate {
  const workingDays = records.length;

  const presentDays = records.filter(
    (r) => isWorkedDayCategory(r.category) && isTargetOrBetterTier(r.ratioTier)
  ).length;
  const shortHoursCount = records.filter(
    (r) => isWorkedDayCategory(r.category) && isShortHoursTier(r.ratioTier)
  ).length;
  const insufficientDataCount = records.filter((r) => r.category === "INSUFFICIENT_DATA").length;
  const overtimeMinutes = records.reduce((sum, r) => sum + r.overtimeMinutes, 0);
  const attendancePercent = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;

  return {
    workingDays,
    presentDays,
    shortHoursCount,
    insufficientDataCount,
    overtimeMinutes,
    attendancePercent,
  };
}
