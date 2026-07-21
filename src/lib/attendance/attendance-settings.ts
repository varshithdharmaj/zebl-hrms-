import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import type { WeeklySchedule } from "@/lib/attendance/schedule-resolver";

const DEFAULT_ID = "default";

export type AttendanceSettingsSnapshot = WeeklySchedule & {
  expectedWorkMinutes: number;
};

async function ensureAttendanceSettingsRow() {
  const existing = await prisma.attendanceSettings.findUnique({ where: { id: DEFAULT_ID } });
  if (existing) return existing;

  try {
    return await prisma.attendanceSettings.create({ data: { id: DEFAULT_ID } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return prisma.attendanceSettings.findUniqueOrThrow({ where: { id: DEFAULT_ID } });
    }
    throw error;
  }
}

/**
 * The attendance domain's own scheduling config — deliberately separate from
 * PayrollSettings. Lazily creates the singleton row on first read, mirroring the
 * getPayrollSettings()/getIntegrationSettings() convention.
 */
export const getAttendanceSettings = cache(async (): Promise<AttendanceSettingsSnapshot> => {
  const row = await ensureAttendanceSettingsRow();
  return {
    mondayWorking: row.mondayWorking,
    tuesdayWorking: row.tuesdayWorking,
    wednesdayWorking: row.wednesdayWorking,
    thursdayWorking: row.thursdayWorking,
    fridayWorking: row.fridayWorking,
    saturdayWorking: row.saturdayWorking,
    sundayWorking: row.sundayWorking,
    expectedWorkMinutes: row.expectedWorkMinutes,
  };
});

export async function getDateOverridesForRange(start: Date, end: Date) {
  return prisma.attendanceDateOverride.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
}
