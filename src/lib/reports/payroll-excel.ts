import * as XLSX from "xlsx";
import type { PayrollHrDecision } from "@prisma/client";
import { formatMinutesAsHours } from "@/lib/payroll/payroll-display";
import { PAYROLL_HR_DECISION_OPTIONS } from "@/lib/payroll/payroll-types";

export type PayrollExportRow = {
  employeeCode: string;
  employeeName: string;
  shift: string;
  workingDays: number;
  requiredHours: string;
  actualHours: string;
  shortfallHours: string;
  otHours: string;
  leaveDays: number;
  absentDays: number;
  lateCount: number;
  recommendedDeduction: string;
  hrDecision: string;
  remarks: string;
};

function decisionLabel(value: PayrollHrDecision): string {
  return PAYROLL_HR_DECISION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function buildPayrollAttendanceExcel(params: {
  periodLabel: string;
  generatedAt: string;
  rows: PayrollExportRow[];
}): Buffer {
  const wb = XLSX.utils.book_new();

  const meta = [
    ["Payroll Attendance Report"],
    ["Payroll period", params.periodLabel],
    ["Generated", params.generatedAt],
    [],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Report Info");

  const data = params.rows.map((r) => ({
    "Employee Code": r.employeeCode,
    "Employee Name": r.employeeName,
    Shift: r.shift,
    "Working Days": r.workingDays,
    "Required Hours": r.requiredHours,
    "Actual Hours": r.actualHours,
    Shortfall: r.shortfallHours,
    OT: r.otHours,
    "Leave Days": r.leaveDays,
    "Absent Days": r.absentDays,
    "Late Count": r.lateCount,
    "Recommended Deduction": r.recommendedDeduction,
    "HR Decision": r.hrDecision,
    Remarks: r.remarks,
  }));

  const sheet = XLSX.utils.json_to_sheet(data);
  sheet["!cols"] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 36 },
    { wch: 18 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, sheet, "Payroll Summary");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function toPayrollExportRow(summary: {
  employee: {
    employeeCode: string;
    name: string;
    department: string | null;
    shift: string | null;
    manager: { name: string } | null;
  };
  workingDays: number;
  requiredMinutes: number;
  actualMinutes: number;
  shortfallMinutes: number;
  otMinutes: number;
  leaveDays: number;
  absentDays: number;
  lateCount: number;
  recommendedDeduction: string | null;
  hrDecision: PayrollHrDecision;
  remarks: string | null;
}): PayrollExportRow {
  return {
    employeeCode: summary.employee.employeeCode,
    employeeName: summary.employee.name,
    shift: summary.employee.shift ?? "—",
    workingDays: summary.workingDays,
    requiredHours: formatMinutesAsHours(summary.requiredMinutes),
    actualHours: formatMinutesAsHours(summary.actualMinutes),
    shortfallHours: formatMinutesAsHours(summary.shortfallMinutes),
    otHours: formatMinutesAsHours(summary.otMinutes),
    leaveDays: summary.leaveDays,
    absentDays: summary.absentDays,
    lateCount: summary.lateCount,
    recommendedDeduction: summary.recommendedDeduction ?? "—",
    hrDecision: decisionLabel(summary.hrDecision),
    remarks: summary.remarks ?? "",
  };
}
