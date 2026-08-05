import { PermissionError } from "@/lib/permissions";
import { PeopleScopeEngine } from "@/lib/people-scope/engine";
import { getAttendanceRecords } from "@/lib/data/attendance";
import { getPayrollSettings } from "@/lib/payroll/payroll-settings";
import { resolveShiftPayrollRules } from "@/lib/payroll/payroll-types";
import {
  isEarlyExitAttendanceRecord,
  isLateAttendanceRecord,
} from "@/lib/payroll/payroll-calculations";
import {
  formatOvertimeDisplay,
  formatTimeAmPm,
  formatWorkedDurationDisplay,
} from "@/lib/attendance-shift";

export type MyTeamAttendanceSort = "name" | "date" | "workedHours";

export type ListMyTeamAttendanceParams = {
  search?: string;
  from?: string;
  to?: string;
  status?: string;
  lateOnly?: boolean;
  earlyExitOnly?: boolean;
  overtimeOnly?: boolean;
  shortfallOnly?: boolean;
  sort?: MyTeamAttendanceSort;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type MyTeamAttendanceRowDto = {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  designation: string | null;
  attendanceDate: Date;
  checkIn: string | null;
  checkOut: string | null;
  checkInDisplay: string;
  checkOutDisplay: string;
  workedHoursDisplay: string;
  workedMinutes: number;
  status: string;
  isLate: boolean;
  isEarlyExit: boolean;
  overtimeDisplay: string;
  overtimeMinutes: number;
  hasShortfall: boolean;
};

export type MyTeamAttendanceListResult = {
  items: MyTeamAttendanceRowDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * My Team attendance list — scope via PeopleScopeEngine, records via shared
 * {@link getAttendanceRecords}, flags via shared payroll attendance helpers.
 */
export async function listMyTeamAttendance(
  managerEmployeeId: number,
  params: ListMyTeamAttendanceParams = {}
): Promise<MyTeamAttendanceListResult> {
  const isManager = await PeopleScopeEngine.isLineManager(managerEmployeeId);
  if (!isManager) {
    throw new PermissionError("My Team attendance is only available to line managers.");
  }

  const scope = await PeopleScopeEngine.resolveScope(managerEmployeeId);
  if (scope.employeeIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: Math.max(1, params.page ?? 1),
      pageSize: Math.min(100, Math.max(1, params.pageSize ?? 15)),
      totalPages: 0,
    };
  }

  const [result, payrollSettings] = await Promise.all([
    getAttendanceRecords({
      employeeIds: scope.employeeIds,
      search: params.search,
      from: params.from,
      to: params.to,
      status: params.status,
      late: params.lateOnly,
      earlyExit: params.earlyExitOnly,
      ot: params.overtimeOnly,
      shortfall: params.shortfallOnly,
      sort: params.sort ?? "date",
      sortDir: params.sortDir ?? "desc",
      page: params.page,
      pageSize: params.pageSize,
    }),
    getPayrollSettings(),
  ]);

  const items: MyTeamAttendanceRowDto[] = result.records.map((record) => {
    const rules = resolveShiftPayrollRules(payrollSettings, record.employee.shift);
    const dailyInput = {
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      workDuration: record.workDuration,
      workedMinutes: record.workedMinutes,
      overtimeMinutes: record.overtimeMinutes,
      status: record.status,
      remarks: record.remarks,
    };
    const isLate = isLateAttendanceRecord(dailyInput, rules.graceMinutes);
    const isEarlyExit = isEarlyExitAttendanceRecord(dailyInput);

    return {
      id: record.id,
      employeeId: record.employee.id,
      employeeName: record.employee.name,
      employeeCode: record.employee.employeeCode,
      department: record.employee.department,
      designation: record.employee.designation,
      attendanceDate: record.attendanceDate,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      checkInDisplay: formatTimeAmPm(record.checkIn),
      checkOutDisplay: formatTimeAmPm(record.checkOut),
      workedHoursDisplay: formatWorkedDurationDisplay(
        record.workDuration,
        record.workedMinutes
      ),
      workedMinutes: record.workedMinutes,
      status: record.status,
      isLate,
      isEarlyExit,
      overtimeDisplay: formatOvertimeDisplay(record.overtimeMinutes),
      overtimeMinutes: record.overtimeMinutes,
      hasShortfall: record.status === "Short Hours",
    };
  });

  return {
    items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };
}
