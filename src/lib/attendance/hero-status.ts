import { minutesToHours } from "@/lib/utils";
import type { AttendanceDayCategory, AttendanceDayResult } from "@/lib/attendance/day-classification";

export type HeroTone = "success" | "info" | "warning" | "danger" | "neutral";

export type HeroBadges = {
  late: boolean;
  earlyCheckout: boolean;
  overtime: boolean;
  shortHours: boolean;
  leaveConflict: boolean;
};

export type HeroStatus = {
  category: AttendanceDayCategory;
  label: string;
  subLabel: string | null;
  tone: HeroTone;
  isLiveInProgress: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  workedLabel: string | null;
  remainingLabel: string | null;
  progressPercent: number | null;
  badges: HeroBadges;
  actionHint: string | null;
};

export function hasRemarkKeyword(remark: string | null, keyword: string): boolean {
  return Boolean(remark && remark.toLowerCase().includes(keyword));
}

/** Real, known values only — never fabricated for a day that's still in progress. */
function completedWorkedFields(day: AttendanceDayResult) {
  return {
    workedLabel: minutesToHours(day.workedMinutes),
    remainingLabel: null,
    progressPercent: day.ratio,
  };
}

/** Only reached when we genuinely have no worked-minutes yet — this system has no
 *  live elapsed-time tracking, so worked/remaining/progress are left uncalculable
 *  rather than guessed at. */
function inProgressWorkedFields(day: AttendanceDayResult, expectedWorkMinutes: number) {
  if (day.workedMinutes <= 0) {
    return { workedLabel: null, remainingLabel: null, progressPercent: null };
  }
  const remaining = Math.max(0, expectedWorkMinutes - day.workedMinutes);
  return {
    workedLabel: minutesToHours(day.workedMinutes),
    remainingLabel: remaining > 0 ? minutesToHours(remaining) : "Target reached",
    progressPercent: day.ratio,
  };
}

/**
 * Maps a canonical AttendanceDayResult (from getEffectiveAttendanceDayType) to Hero
 * presentation data. Pure and side-effect free — no calculation here duplicates the
 * classifier; this only chooses labels/tone/which fields are meaningful to show.
 */
export function getHeroStatus(
  day: AttendanceDayResult,
  opts: { isToday: boolean; expectedWorkMinutes: number }
): HeroStatus {
  const badges: HeroBadges = {
    late: hasRemarkKeyword(day.remark, "late"),
    earlyCheckout: hasRemarkKeyword(day.remark, "early"),
    overtime: day.overtimeMinutes > 0,
    // Only meaningful once the day is over — a low ratio mid-day just means the day
    // isn't finished yet, not that it will end up short.
    shortHours:
      Boolean(day.checkOut) && (day.ratioTier === "very_low" || day.ratioTier === "partial"),
    leaveConflict: day.hasLeaveConflict,
  };

  // Genuinely "live" whenever it's today, checked in, and not yet checked out —
  // whether or not a worked-minutes figure has synced yet. Only the worked/remaining
  // fields (below) get suppressed when that figure isn't available, so nothing here
  // is ever fabricated.
  const isLiveInProgress = opts.isToday && Boolean(day.checkIn) && !day.checkOut;

  if (isLiveInProgress) {
    const subLabel =
      day.category === "WORKED_ON_HOLIDAY"
        ? "Working on a holiday"
        : day.category === "WORKED_ON_WEEKLY_OFF"
          ? "Working on your weekly off"
          : null;
    return {
      category: day.category,
      label: "Checked in",
      subLabel,
      tone: "info",
      isLiveInProgress: true,
      checkInTime: day.checkIn,
      checkOutTime: null,
      actionHint: null,
      badges,
      ...inProgressWorkedFields(day, opts.expectedWorkMinutes),
    };
  }

  const notWorking = {
    checkInTime: null,
    checkOutTime: null,
    workedLabel: null,
    remainingLabel: null,
    progressPercent: null,
  };

  switch (day.category) {
    case "HOLIDAY":
      return {
        category: day.category,
        label: "Holiday",
        subLabel: day.holidayName,
        tone: "neutral",
        isLiveInProgress: false,
        actionHint: null,
        badges,
        ...notWorking,
      };
    case "WEEKLY_OFF":
      return {
        category: day.category,
        label: "Weekly off",
        subLabel: null,
        tone: "neutral",
        isLiveInProgress: false,
        actionHint: null,
        badges,
        ...notWorking,
      };
    case "LEAVE":
      return {
        category: day.category,
        label: "On leave",
        subLabel: day.leaveType ? `${day.leaveType} leave` : null,
        tone: "info",
        isLiveInProgress: false,
        actionHint: null,
        badges,
        ...notWorking,
      };
    case "WORKED_ON_HOLIDAY":
      return {
        category: day.category,
        label: "Worked on holiday",
        subLabel: day.holidayName,
        tone: "success",
        isLiveInProgress: false,
        checkInTime: day.checkIn,
        checkOutTime: day.checkOut,
        actionHint: null,
        badges,
        ...completedWorkedFields(day),
      };
    case "WORKED_ON_WEEKLY_OFF":
      return {
        category: day.category,
        label: "Worked on your weekly off",
        subLabel: null,
        tone: "success",
        isLiveInProgress: false,
        checkInTime: day.checkIn,
        checkOutTime: day.checkOut,
        actionHint: null,
        badges,
        ...completedWorkedFields(day),
      };
    case "PRESENT":
      return {
        category: day.category,
        label: "Work completed",
        subLabel: null,
        tone: "success",
        isLiveInProgress: false,
        checkInTime: day.checkIn,
        checkOutTime: day.checkOut,
        actionHint: null,
        badges,
        ...completedWorkedFields(day),
      };
    case "INSUFFICIENT_DATA":
      // By construction this only reaches here for a non-today date (today's
      // equivalent is caught by isLiveInProgress above).
      return {
        category: day.category,
        label: "Incomplete attendance record",
        subLabel: "Check-in was recorded, but check-out or worked hours are missing.",
        tone: "warning",
        isLiveInProgress: false,
        checkInTime: day.checkIn,
        checkOutTime: day.checkOut,
        actionHint: "Contact HR if this doesn't look right.",
        badges,
        workedLabel: null,
        remainingLabel: null,
        progressPercent: null,
      };
    case "ABSENT":
    default:
      return opts.isToday
        ? {
            category: day.category,
            label: "Not checked in yet",
            subLabel: null,
            tone: "warning",
            isLiveInProgress: false,
            actionHint: "Your attendance will update once it's recorded.",
            badges,
            ...notWorking,
          }
        : {
            category: day.category,
            label: "Absent",
            subLabel: null,
            tone: "danger",
            isLiveInProgress: false,
            actionHint: null,
            badges,
            ...notWorking,
          };
  }
}
