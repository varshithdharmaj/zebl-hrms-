import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import type { WeeklySchedule } from "@/lib/attendance/schedule-resolver";

const DEFAULT_ID = "default";

export type AttendanceSettingsSnapshot = WeeklySchedule & {
  expectedWorkMinutes: number;
};

function yearsTouching(start: Date, end: Date): number[] {
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y += 1) {
    years.push(y);
  }
  return years.length > 0 ? years : [startYear];
}

function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

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

/** Request-memoized overrides for a calendar year — period + YTD share one query. */
const getDateOverridesForYear = cache(async (year: number) => {
  const { start, end } = yearBounds(year);
  return prisma.attendanceDateOverride.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
});

export async function getDateOverridesForRange(start: Date, end: Date) {
  const years = yearsTouching(start, end);
  const byYear = await Promise.all(years.map((y) => getDateOverridesForYear(y)));
  const startMs = start.getTime();
  const endMs = end.getTime();
  return byYear
    .flat()
    .filter((o) => {
      const t = o.date.getTime();
      return t >= startMs && t <= endMs;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
