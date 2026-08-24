import { cache } from "react";
import { prisma } from "@/lib/prisma";

function yearBoundsExclusive(year: number): { start: Date; endExclusive: Date } {
  return {
    start: new Date(year, 0, 1),
    endExclusive: new Date(year + 1, 0, 1),
  };
}

/**
 * Request-memoized attendance rows for one employee + calendar year, including
 * sessions (needed to derive break minutes). Employee dashboard period classify +
 * YTD heatmap share one DB round-trip when both ranges fall in the same year
 * (the common case); the heatmap simply ignores the `sessions` field.
 */
export const getEmployeeAttendanceRecordsForYear = cache(
  async (employeeId: number, year: number) => {
    const { start, endExclusive } = yearBoundsExclusive(year);
    return prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        attendanceDate: { gte: start, lt: endExclusive },
      },
      orderBy: { attendanceDate: "asc" },
      include: {
        sessions: { orderBy: [{ checkIn: "asc" }, { id: "asc" }] },
      },
    });
  }
);

function yearsTouching(start: Date, endExclusiveOrInclusive: Date): number[] {
  const startYear = start.getFullYear();
  // end may be exclusive (toExclusive) or inclusive; using getFullYear is safe either way
  // when callers pass toExclusive (start of next day) or inclusive end-of-day.
  let endYear = endExclusiveOrInclusive.getFullYear();
  if (
    endExclusiveOrInclusive.getMonth() === 0 &&
    endExclusiveOrInclusive.getDate() === 1 &&
    endExclusiveOrInclusive.getTime() > start.getTime()
  ) {
    // Exclusive Jan 1 of year Y means the range ended in year Y-1.
    endYear = Math.max(startYear, endYear - 1);
  }
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y += 1) {
    years.push(y);
  }
  return years.length > 0 ? years : [startYear];
}

/**
 * Attendance records for [rangeStart, toExclusive) via year-cached loads + in-memory filter.
 */
export async function getEmployeeAttendanceRecordsForRange(
  employeeId: number,
  rangeStart: Date,
  toExclusive: Date
) {
  const years = yearsTouching(rangeStart, toExclusive);
  const byYear = await Promise.all(
    years.map((y) => getEmployeeAttendanceRecordsForYear(employeeId, y))
  );
  const startMs = rangeStart.getTime();
  const endMs = toExclusive.getTime();
  return byYear
    .flat()
    .filter((r) => {
      const t = r.attendanceDate.getTime();
      return t >= startMs && t < endMs;
    })
    .sort((a, b) => a.attendanceDate.getTime() - b.attendanceDate.getTime());
}
