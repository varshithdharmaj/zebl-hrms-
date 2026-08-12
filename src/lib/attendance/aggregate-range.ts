import {
  isBelowTargetPresentDay,
  isExcellentPresentDay,
  isPresentDay,
  isWorkedDayCategory,
} from "@/lib/attendance/day-classification";
import type { ClassifiedAttendanceRecord } from "@/lib/attendance/history-classification";

export type AttendanceRangeAggregate = {
  workingDays: number;
  /**
   * Canonical Present: any attended/worked day (below-target + excellent).
   * Must match heatmap month `presentDays` for the same classified days.
   */
  presentDays: number;
  /** Worked days at/above expected hours (heatmap Excellent). */
  excellentDays: number;
  /** Worked days below expected hours (heatmap soft-green band). */
  shortHoursCount: number;
  insufficientDataCount: number;
  overtimeMinutes: number;
  attendancePercent: number;
};

/**
 * Numeric KPI aggregation over already-classified attendance rows.
 * Present / Excellent / Short hours use the same predicates as heatmap-month-stats.
 */
export function aggregateAttendanceForRange(
  records: ClassifiedAttendanceRecord[]
): AttendanceRangeAggregate {
  const workingDays = records.length;

  const presentDays = records.filter((r) => isPresentDay(r.category, r.ratioTier)).length;
  const excellentDays = records.filter((r) =>
    isExcellentPresentDay(r.category, r.ratioTier)
  ).length;
  const shortHoursCount = records.filter((r) =>
    isBelowTargetPresentDay(r.category, r.ratioTier)
  ).length;
  const insufficientDataCount = records.filter((r) => r.category === "INSUFFICIENT_DATA").length;
  const overtimeMinutes = records.reduce((sum, r) => sum + r.overtimeMinutes, 0);
  const attendancePercent = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;

  return {
    workingDays,
    presentDays,
    excellentDays,
    shortHoursCount,
    insufficientDataCount,
    overtimeMinutes,
    attendancePercent,
  };
}

/** Invariant helper for tests: Present partitions into Excellent + Short hours. */
export function assertPresentPartition(aggregate: AttendanceRangeAggregate): boolean {
  return aggregate.presentDays === aggregate.excellentDays + aggregate.shortHoursCount;
}

export function countWorkedDays(records: ClassifiedAttendanceRecord[]): number {
  return records.filter((r) => isWorkedDayCategory(r.category)).length;
}
