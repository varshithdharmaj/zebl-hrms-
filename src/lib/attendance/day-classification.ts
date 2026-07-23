import type { AttendanceOverrideType } from "@/generated/prisma/client";
import { hasCheckIn } from "@/lib/attendance";
import {
  resolveEffectiveScheduleType,
  type AttendanceScheduleType,
  type WeeklySchedule,
} from "@/lib/attendance/schedule-resolver";

/**
 * The eight terminal attendance-day outcomes. `WORKING_DAY` is deliberately not a
 * category here — it's a schedule *type* (see AttendanceScheduleType), not an
 * attendance outcome; every working-day scenario resolves to PRESENT, ABSENT, or
 * INSUFFICIENT_DATA.
 */
export type AttendanceDayCategory =
  | "HOLIDAY"
  | "WEEKLY_OFF"
  | "LEAVE"
  | "ABSENT"
  | "PRESENT"
  | "INSUFFICIENT_DATA"
  | "WORKED_ON_WEEKLY_OFF"
  | "WORKED_ON_HOLIDAY";

export type AttendanceRatioTier = "very_low" | "partial" | "near_target" | "target" | "overtime";

/** A day the employee actually worked, whether or not it was a scheduled working day —
 *  shared by the Heatmap, History, and aggregate KPIs so "was this a worked day" is
 *  answered the same way everywhere. */
export function isWorkedDayCategory(category: AttendanceDayCategory): boolean {
  return category === "PRESENT" || category === "WORKED_ON_WEEKLY_OFF" || category === "WORKED_ON_HOLIDAY";
}

/** Checked in with enough data to judge, but below the expected-hours ratio. */
export function isShortHoursTier(ratioTier: AttendanceRatioTier | null): boolean {
  return ratioTier === "very_low" || ratioTier === "partial" || ratioTier === "near_target";
}

/** Met or exceeded the expected-hours ratio. */
export function isTargetOrBetterTier(ratioTier: AttendanceRatioTier | null): boolean {
  return ratioTier === "target" || ratioTier === "overtime";
}

export type AttendanceDayInput = {
  date: Date;
  attendanceRecord: {
    checkIn: string | null;
    checkOut: string | null;
    workedMinutes: number;
    overtimeMinutes: number;
    remarks: string | null;
  } | null;
  holiday: { name: string } | null;
  approvedLeave: { leaveType: string } | null;
  weeklySchedule: WeeklySchedule;
  dateOverride: AttendanceOverrideType | null;
  expectedWorkMinutes: number;
};

export type AttendanceDayResult = {
  date: Date;
  category: AttendanceDayCategory;
  scheduleType: AttendanceScheduleType;
  workedMinutes: number;
  overtimeMinutes: number;
  ratio: number | null;
  ratioTier: AttendanceRatioTier | null;
  checkIn: string | null;
  checkOut: string | null;
  remark: string | null;
  holidayName: string | null;
  leaveType: string | null;
  /** Approved leave overlaps a date with real attendance — surfaced, never hidden (Rule 3). */
  hasLeaveConflict: boolean;
};

function getRatioTier(ratio: number): AttendanceRatioTier {
  if (ratio < 50) return "very_low";
  if (ratio < 80) return "partial";
  if (ratio < 100) return "near_target";
  if (ratio < 120) return "target";
  return "overtime";
}

/**
 * The single canonical attendance-day classifier. Every consumer (dashboard heatmap,
 * attendance page, future analytics) must call this instead of re-deriving day type —
 * see the audit's duplication findings for why this function exists.
 */
export function getEffectiveAttendanceDayType(input: AttendanceDayInput): AttendanceDayResult {
  const {
    date,
    attendanceRecord,
    holiday,
    approvedLeave,
    weeklySchedule,
    dateOverride,
    expectedWorkMinutes,
  } = input;

  const scheduleType = resolveEffectiveScheduleType(date, weeklySchedule, dateOverride);
  const attendanceExists = attendanceRecord != null && hasCheckIn(attendanceRecord.checkIn);

  const base = {
    date,
    scheduleType,
    workedMinutes: attendanceRecord?.workedMinutes ?? 0,
    overtimeMinutes: attendanceRecord?.overtimeMinutes ?? 0,
    checkIn: attendanceRecord?.checkIn ?? null,
    checkOut: attendanceRecord?.checkOut ?? null,
    remark: attendanceRecord?.remarks ?? null,
    holidayName: holiday?.name ?? null,
    leaveType: approvedLeave?.leaveType ?? null,
  };

  if (attendanceExists) {
    // Rule 3: approved leave never hides real attendance — it's surfaced as a conflict flag.
    const hasLeaveConflict = approvedLeave != null;
    const workedMinutes = attendanceRecord!.workedMinutes;
    const hasEnoughData =
      workedMinutes > 0 || (Boolean(attendanceRecord!.checkIn) && Boolean(attendanceRecord!.checkOut));

    if (!hasEnoughData) {
      return { ...base, category: "INSUFFICIENT_DATA", ratio: null, ratioTier: null, hasLeaveConflict };
    }

    const ratio =
      expectedWorkMinutes > 0 ? Math.round((workedMinutes / expectedWorkMinutes) * 100) : 0;
    const ratioTier = getRatioTier(ratio);

    if (scheduleType === "weekly_off") {
      return { ...base, category: "WORKED_ON_WEEKLY_OFF", ratio, ratioTier, hasLeaveConflict };
    }
    if (holiday) {
      return { ...base, category: "WORKED_ON_HOLIDAY", ratio, ratioTier, hasLeaveConflict };
    }
    return { ...base, category: "PRESENT", ratio, ratioTier, hasLeaveConflict };
  }

  // No valid attendance exists — priority per Rules 1–6: override > holiday > leave > schedule.
  if (dateOverride === "weekly_off") {
    return { ...base, category: "WEEKLY_OFF", ratio: null, ratioTier: null, hasLeaveConflict: false };
  }
  if (dateOverride === "working_day") {
    return { ...base, category: "ABSENT", ratio: null, ratioTier: null, hasLeaveConflict: false };
  }
  if (holiday) {
    return { ...base, category: "HOLIDAY", ratio: null, ratioTier: null, hasLeaveConflict: false };
  }
  if (approvedLeave) {
    return { ...base, category: "LEAVE", ratio: null, ratioTier: null, hasLeaveConflict: false };
  }
  if (scheduleType === "weekly_off") {
    return { ...base, category: "WEEKLY_OFF", ratio: null, ratioTier: null, hasLeaveConflict: false };
  }
  return { ...base, category: "ABSENT", ratio: null, ratioTier: null, hasLeaveConflict: false };
}
