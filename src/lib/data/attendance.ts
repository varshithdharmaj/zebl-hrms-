import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOperationalShiftFilterOption } from "@/lib/attendance-shift";
import { parsePayrollPeriodKey } from "@/lib/payroll/payroll-period";
import { getPayrollSettings } from "@/lib/payroll/payroll-settings";
import { aggregateAttendanceForRange } from "@/lib/attendance/aggregate-range";
import { classifyAttendanceRecords, dateSpanOf } from "@/lib/attendance/history-classification";
import { getEmployeeAttendanceRecordsForRange } from "@/lib/attendance/employee-attendance-year-cache";
import {
  startOfDay,
  endOfDay,
  parseDateRange,
  toISODate,
} from "@/lib/utils";
import {
  PAGE_SIZE,
  RANGE_RECORD_LIMIT,
  DASHBOARD_HISTORY_PREVIEW_LIMIT,
} from "@/lib/data/constants";

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

  const { rangeStart, rangeEnd, toExclusive, startIso, endIso, rangeLabel } = parseDateRange(
    startStr,
    endStr
  );
  const dayEndExclusive = startOfDay(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1)
  );

  const [dayRecord, periodRecords] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        attendanceDate: { gte: selectedDate, lt: dayEndExclusive },
      },
      include: {
        sessions: { orderBy: [{ checkIn: "asc" }, { id: "asc" }] },
      },
    }),
    // Year-cached range load — shares DB work with YTD heatmap in the same request.
    getEmployeeAttendanceRecordsForRange(employeeId, rangeStart, toExclusive),
  ]);

  // Classified once for the whole period — KPIs use the full list; history preview is sliced below.
  const classifiedPeriodRecords = await classifyAttendanceRecords(
    employeeId,
    periodRecords,
    rangeStart,
    rangeEnd
  );
  const classifiedRecentRecords = [...classifiedPeriodRecords]
    .reverse()
    .slice(0, DASHBOARD_HISTORY_PREVIEW_LIMIT);
  const aggregate = aggregateAttendanceForRange(classifiedPeriodRecords);

  const sessions =
    dayRecord?.sessions.map((s) => ({
      id: s.id,
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      workedMinutes: s.workedMinutes,
      isOpen: s.checkOut === null,
    })) ?? [];

  // Legacy fallback when sessions have not been backfilled yet
  const displaySessions =
    sessions.length > 0
      ? sessions
      : dayRecord?.checkIn
        ? [
            {
              id: 0,
              checkIn: dayRecord.checkIn,
              checkOut: dayRecord.checkOut,
              workedMinutes: dayRecord.workedMinutes,
              isOpen: dayRecord.checkOut === null,
            },
          ]
        : [];

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
      sessions: displaySessions,
      hasOpenSession: displaySessions.some((s) => s.isOpen),
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
    /** Total classified rows in range — history UI uses this for "Showing X of Y" / View all. */
    recentRecordsTotal: classifiedPeriodRecords.length,
  };
}

export async function getEmployeeAttendanceSummary(
  employeeId: number,
  startStr?: string,
  endStr?: string
) {
  const { rangeStart, rangeEnd, toExclusive, startIso, endIso, rangeLabel } = parseDateRange(
    startStr,
    endStr
  );

  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeId,
      attendanceDate: { gte: rangeStart, lt: toExclusive },
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
  /** Inclusive ISO date range start (YYYY-MM-DD). Ignored when `period` is set. */
  from?: string;
  /** Inclusive ISO date range end (YYYY-MM-DD). Ignored when `period` is set. */
  to?: string;
  period?: string;
  shift?: string;
  status?: string;
  shortfall?: boolean;
  ot?: boolean;
  /** Restrict to these employee IDs (e.g. My Team scope). Empty array → no rows. */
  employeeIds?: number[];
  /** Approximate late filter (remarks or Short Hours with check-in). */
  late?: boolean;
  /** Remarks-based early exit filter. */
  earlyExit?: boolean;
  sort?: "name" | "date" | "workedHours";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}) {
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? PAGE_SIZE));
  const page = Math.max(1, params.page ?? 1);
  const skip = (page - 1) * pageSize;
  const sortDir = params.sortDir === "asc" ? "asc" : "desc";

  if (params.employeeIds && params.employeeIds.length === 0) {
    return {
      records: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const where: Prisma.AttendanceRecordWhereInput = {};

  if (params.employeeIds) {
    where.employeeId = { in: params.employeeIds };
  }

  if (params.period) {
    const settings = await getPayrollSettings();
    const period = parsePayrollPeriodKey(params.period, settings.payrollStartDay);
    where.attendanceDate = { gte: period.start, lte: period.end };
  } else if (params.from || params.to) {
    const range = parseDateRange(params.from, params.to);
    where.attendanceDate = {
      gte: range.rangeStart,
      lt: range.toExclusive,
    };
  } else if (params.date) {
    const d = startOfDay(new Date(params.date));
    if (!Number.isNaN(d.getTime())) {
      where.attendanceDate = { gte: d, lte: endOfDay(d) };
    }
  }

  if (params.status?.trim()) {
    where.status = { equals: params.status.trim(), mode: "insensitive" };
  }

  if (params.shortfall) {
    where.status = "Short Hours";
  }
  if (params.ot) {
    where.overtimeMinutes = { gt: 0 };
  }

  if (params.late) {
    where.OR = [
      { remarks: { contains: "late", mode: "insensitive" } },
      {
        AND: [{ status: "Short Hours" }, { checkIn: { not: null } }],
      },
    ];
  }

  if (params.earlyExit) {
    where.remarks = { contains: "early", mode: "insensitive" };
  }

  const shiftFilter = getOperationalShiftFilterOption(params.shift);
  const employeeWhere: Prisma.EmployeeWhereInput = {};

  if (params.search) {
    const q = params.search.trim();
    employeeWhere.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { employeeCode: { contains: q, mode: "insensitive" } },
      { department: { contains: q, mode: "insensitive" } },
    ];
  }

  if (shiftFilter.value) {
    employeeWhere.shift = { equals: shiftFilter.label, mode: "insensitive" };
  }

  if (Object.keys(employeeWhere).length > 0) {
    where.employee = employeeWhere;
  }

  const orderBy: Prisma.AttendanceRecordOrderByWithRelationInput[] =
    params.sort === "name"
      ? [{ employee: { name: sortDir } }, { attendanceDate: "desc" }]
      : params.sort === "workedHours"
        ? [{ workedMinutes: sortDir }, { attendanceDate: "desc" }]
        : [{ attendanceDate: sortDir }, { employee: { name: "asc" } }];

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            department: true,
            designation: true,
            shift: true,
          },
        },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return {
    records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getEmployeeAttendanceHistory(
  employeeId: number,
  page = 1,
  startStr?: string,
  endStr?: string
) {
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.AttendanceRecordWhereInput = { employeeId };

  let explicitRange: { rangeStart: Date; rangeEnd: Date; toExclusive: Date } | null = null;
  if (startStr || endStr) {
    explicitRange = parseDateRange(startStr, endStr);
    where.attendanceDate = {
      gte: explicitRange.rangeStart,
      lt: explicitRange.toExclusive,
    };
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
