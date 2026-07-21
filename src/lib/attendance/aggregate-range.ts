export type AttendanceRangeAggregate = {
  workingDays: number;
  presentDays: number;
  shortHoursCount: number;
  overtimeMinutes: number;
  attendancePercent: number;
};

/**
 * Numeric KPI aggregation over a set of attendance rows — deliberately separate from
 * day classification (`getEffectiveAttendanceDayType`), which answers a different
 * question. Extracted from the duplicated inline logic previously in
 * `getEmployeeDashboardData` and `getEmployeeAttendanceSummary`.
 */
export function aggregateAttendanceForRange(
  records: { status: string; overtimeMinutes: number }[]
): AttendanceRangeAggregate {
  const workingDays = records.length;
  const presentDays = records.filter((r) => r.status === "Present").length;
  const shortHoursCount = records.filter((r) => r.status === "Short Hours").length;
  const overtimeMinutes = records.reduce((sum, r) => sum + r.overtimeMinutes, 0);
  const attendancePercent = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;

  return { workingDays, presentDays, shortHoursCount, overtimeMinutes, attendancePercent };
}
