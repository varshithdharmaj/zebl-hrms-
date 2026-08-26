import { hasCheckIn, parseDurationToMinutes } from "@/lib/attendance";
import type { PayrollSettingsSnapshot } from "@/lib/payroll/payroll-types";
import { resolveShiftPayrollRules } from "@/lib/payroll/payroll-types";
export { formatMinutesAsHours } from "@/lib/payroll/payroll-display";

export type DailyAttendanceInput = {
  checkIn: string | null;
  checkOut: string | null;
  workDuration: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  status: string;
  remarks: string | null;
};

export type EmployeePeriodMetrics = {
  workingDays: number;
  requiredMinutes: number;
  actualMinutes: number;
  shortfallMinutes: number;
  otMinutes: number;
  leaveDays: number;
  absentDays: number;
  lateCount: number;
  recommendedDeduction: string | null;
};

function actualMinutesForDay(record: DailyAttendanceInput): number {
  if (record.workedMinutes > 0) return record.workedMinutes;
  if (record.checkIn && record.checkOut) {
    const fromDuration = parseDurationToMinutes(record.workDuration);
    if (fromDuration > 0) return fromDuration;
    const inParts = record.checkIn.split(":").map(Number);
    const outParts = record.checkOut.split(":").map(Number);
    if (inParts.length >= 2 && outParts.length >= 2) {
      const inMins = inParts[0] * 60 + inParts[1];
      const outMins = outParts[0] * 60 + outParts[1];
      return outMins >= inMins ? outMins - inMins : 24 * 60 - inMins + outMins;
    }
  }
  return 0;
}

function isLateRecord(record: DailyAttendanceInput, graceMinutes: number): boolean {
  const remarks = record.remarks?.toLowerCase() ?? "";
  if (remarks.includes("late")) return true;
  return (
    hasCheckIn(record.checkIn) &&
    record.status === "Short Hours" &&
    actualMinutesForDay(record) > graceMinutes
  );
}

export function computeEmployeePeriodMetrics(
  records: DailyAttendanceInput[],
  settings: PayrollSettingsSnapshot,
  employeeShift: string | null | undefined,
  approvedLeaveDays: number
): EmployeePeriodMetrics {
  const rules = resolveShiftPayrollRules(settings, employeeShift);
  const workingDays = records.length;

  let requiredMinutes = 0;
  let actualMinutes = 0;
  let shortfallMinutes = 0;
  let otMinutes = 0;
  let absentDays = 0;
  let lateCount = 0;

  for (const record of records) {
    const dayActual = actualMinutesForDay(record);
    const dayRequired = rules.requiredOfficeMinutes;
    requiredMinutes += dayRequired;
    actualMinutes += dayActual;

    if (!hasCheckIn(record.checkIn) || record.status === "Absent") {
      absentDays++;
    }

    if (isLateRecord(record, rules.graceMinutes)) {
      lateCount++;
    }

    const effectiveShortfall = Math.max(0, dayRequired - dayActual - rules.graceMinutes);
    const dayOt = Math.max(0, dayActual - dayRequired - rules.otThresholdMinutes);

    shortfallMinutes += effectiveShortfall;
    otMinutes += Math.max(dayOt, record.overtimeMinutes);
  }

  const recommendedDeduction = buildRecommendedDeduction(
    shortfallMinutes,
    settings.halfDayThresholdMinutes
  );

  return {
    workingDays,
    requiredMinutes,
    actualMinutes,
    shortfallMinutes,
    otMinutes,
    leaveDays: approvedLeaveDays,
    absentDays,
    lateCount,
    recommendedDeduction,
  };
}

function buildRecommendedDeduction(
  shortfallMinutes: number,
  halfDayThresholdMinutes: number
): string | null {
  if (shortfallMinutes <= 0) return null;
  if (shortfallMinutes >= halfDayThresholdMinutes * 2) {
    return "Review: full-day leave or salary deduction may apply";
  }
  if (shortfallMinutes >= halfDayThresholdMinutes) {
    return "Review: half-day leave may apply";
  }
  return "Review: minor shortfall — warning or exception";
}

