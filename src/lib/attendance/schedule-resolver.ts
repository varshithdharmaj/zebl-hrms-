import type { AttendanceOverrideType } from "@/generated/prisma/client";

/** Effective schedule type for a single date — the input dimension to classification, not a final category. */
export type AttendanceScheduleType = "working_day" | "weekly_off";

export type WeeklySchedule = {
  mondayWorking: boolean;
  tuesdayWorking: boolean;
  wednesdayWorking: boolean;
  thursdayWorking: boolean;
  fridayWorking: boolean;
  saturdayWorking: boolean;
  sundayWorking: boolean;
};

const DAY_INDEX_TO_KEY: Record<number, keyof WeeklySchedule> = {
  0: "sundayWorking",
  1: "mondayWorking",
  2: "tuesdayWorking",
  3: "wednesdayWorking",
  4: "thursdayWorking",
  5: "fridayWorking",
  6: "saturdayWorking",
};

/** The default weekly schedule's classification for `date`, ignoring any date override. */
export function getDefaultScheduleTypeForDate(
  date: Date,
  schedule: WeeklySchedule
): AttendanceScheduleType {
  const key = DAY_INDEX_TO_KEY[date.getDay()];
  return schedule[key] ? "working_day" : "weekly_off";
}

/** Date-specific overrides always win over the default weekly schedule. */
export function resolveEffectiveScheduleType(
  date: Date,
  schedule: WeeklySchedule,
  overrideType?: AttendanceOverrideType | null
): AttendanceScheduleType {
  if (overrideType) return overrideType;
  return getDefaultScheduleTypeForDate(date, schedule);
}
