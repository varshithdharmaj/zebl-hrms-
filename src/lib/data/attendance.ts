import { prisma } from "@/lib/prisma";
import { getOperationalShiftFilterOption } from "@/lib/attendance-shift";
import { parsePayrollPeriodKey } from "@/lib/payroll/payroll-period";
import { getPayrollSettings } from "@/lib/payroll/payroll-settings";
import { aggregateAttendanceForRange } from "@/lib/attendance/aggregate-range";
import { classifyAttendanceRecords, dateSpanOf } from "@/lib/attendance/history-classification";
import {
  startOfDay,
  endOfDay,
  parseDateRange,
  toISODate,
} from "@/lib/utils";
import { PAGE_SIZE, RANGE_RECORD_LIMIT } from "@/lib/data/constants";

export async function getEmployeeDashboardData(
  employeeId: number,
  selectedDateStr?: string,
  startStr?: string,
  endStr?: string
) {
  const selectedDate = selectedDateStr
    ? startOfDay(new Date(selectedDateStr + "T00:00:00"))
    : startOfDay();

  if (Number.isNaN(selectedDate.getTime())) {
    return getEmployeeDashboardData(employeeId, undefined, startStr, endStr);
  }

  const { rangeStart, rangeEnd, startIso, endIso, rangeLabel } = parseDateRange(
    startStr,
    endStr
  );
  const dayEnd = endOfDay(selectedDate);

  const [dayRecord, periodRecords] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        attendanceDate: { gte: selectedDate, lte: dayEnd },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        attendanceDate: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { attendanceDate: "asc" },
    }),
  ]);

  // Classified once for the whole period — the KPI aggregate and the History preview's
  // recent-records slice both read off this same list, so there's no second round-trip
  // for holiday/leave/override data covering the identical date range.
  const classifiedPeriodRecords = await classifyAttendanceRecords(
    employeeId,
    periodRecords,
    rangeStart,
    rangeEnd
  );
  const classifiedRecentRecords = [...classifiedPeriodRecords].reverse().slice(0, RANGE_RECORD_LIMIT);
  const aggregate = aggregateAttendanceForRange(classifiedPeriodRecords);

  return {
    selectedDate: toISODate(selectedDate),
    selectedStart: startIso,
    selectedEnd: endIso,
    day: {
      workedMinutes: dayRecord?.workedMinutes ?? 0,
      checkIn: dayRecord?.checkIn ?? null,
      checkOut: dayRecord?.checkOut ?? null,
      overtimeMinutes: dayRecord?.overtimeMinutes ?? 0,
      status: dayRecord?.status ?? "No Record",
      remarks: dayRecord?.remarks ?? null,
    },
    period: {
      presentDays: aggregate.presentDays,
      shortHoursCount: aggregate.shortHoursCount,
      insufficientDataCount: aggregate.insufficientDataCount,
      overtimeMinutes: aggregate.overtimeMinutes,
      attendancePercent: aggregate.attendancePercent,
      rangeLabel,
    },
    periodRecords,
    recentRecords: classifiedRecentRecords,
  };
}

export async function getEmployeeAttendanceSummary(
  employeeId: number,
  startStr?: string,
  endStr?: string
) {
  const { rangeStart, rangeEnd, startIso, endIso, rangeLabel } = parseDateRange(
    startStr,
    endStr
  );

  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeId,
      attendanceDate: { gte: rangeStart, lte: rangeEnd },
    },
    orderBy: { attendanceDate: "desc" },
    take: RANGE_RECORD_LIMIT,
  });

  const classifiedRecords = await classifyAttendanceRecords(employeeId, records, rangeStart, rangeEnd);
  const aggregate = aggregateAttendanceForRange(classifiedRecords);

  const lastRecord = await prisma.attendanceRecord.findFirst({
    where: { employeeId },
    orderBy: { attendanceDate: "desc" },
  });

  return {
    rangeLabel,
    selectedStart: startIso,
    selectedEnd: endIso,
    presentDays: aggregate.presentDays,
    shortHoursCount: aggregate.shortHoursCount,
    insufficientDataCount: aggregate.insufficientDataCount,
    overtimeMinutes: aggregate.overtimeMinutes,
    attendancePercent: aggregate.attendancePercent,
    lastAttendanceDate: lastRecord?.attendanceDate ?? null,
    records: classifiedRecords,
  };
}

export async function getAttendanceRecords(params: {
  search?: string;
  date?: string;
  period?: string;
  shift?: string;
  shortfall?: boolean;
  ot?: boolean;
  page?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (params.period) {
    const settings = await getPayrollSettings();
    const period = parsePayrollPeriodKey(params.period, settings.payrollStartDay);
    where.attendanceDate = { gte: period.start, lte: period.end };
  } else if (params.date) {
    const d = startOfDay(new Date(params.date));
    if (!Number.isNaN(d.getTime())) {
      where.attendanceDate = { gte: d, lte: endOfDay(d) };
    }
  }

  if (params.shortfall) {
    where.status = "Short Hours";
  }
  if (params.ot) {
    where.overtimeMinutes = { gt: 0 };
  }

  const shiftFilter = getOperationalShiftFilterOption(params.shift);
  const employeeWhere: Record<string, unknown> = {};

  if (params.search) {
    const q = params.search.trim();
    employeeWhere.OR = [{ name: { contains: q } }, { employeeCode: { contains: q } }];
  }

  if (shiftFilter.value) {
    employeeWhere.shift = { equals: shiftFilter.label, mode: "insensitive" };
  }

  if (Object.keys(employeeWhere).length > 0) {
    where.employee = employeeWhere;
  }

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: { employee: true },
      orderBy: [{ attendanceDate: "desc" }, { employee: { name: "asc" } }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return {
    records,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getEmployeeAttendanceHistory(
  employeeId: number,
  page = 1,
  startStr?: string,
  endStr?: string
) {
  const skip = (page - 1) * PAGE_SIZE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { employeeId };

  let explicitRange: { rangeStart: Date; rangeEnd: Date } | null = null;
  if (startStr || endStr) {
    explicitRange = parseDateRange(startStr, endStr);
    where.attendanceDate = { gte: explicitRange.rangeStart, lte: explicitRange.rangeEnd };
  }

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: { attendanceDate: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  // No explicit filter means "all time" — bound the classifier's holiday/leave/override
  // lookups to this page's own actual date span rather than an unbounded range.
  const { start, end } = explicitRange
    ? { start: explicitRange.rangeStart, end: explicitRange.rangeEnd }
    : dateSpanOf(records);
  const classifiedRecords = await classifyAttendanceRecords(employeeId, records, start, end);

  return {
    records: classifiedRecords,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
