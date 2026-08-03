import { prisma } from "@/lib/prisma";
import { formatTimeCell } from "./cell-utils";
import { resolveImportAttendanceDate } from "./types";
import type { AttendanceImportFormat, AttendanceImportRow, AttendanceReportType } from "./types";
import type {
  AttendanceImportIssue,
  AttendanceImportPreview,
  AttendanceImportPreviewSummary,
  AttendancePreviewRow,
  AttendancePreviewValidationStatus,
} from "./preview-types";
import { toISODate, startOfDay } from "@/lib/utils";

const TIME_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;
const KNOWN_STATUS =
  /^(present|absent|week\s*off|weekend|holiday|leave|half[\s-]?day|short\s*hours|on\s*leave|wo|hl|cl|sl|el|od|ms|weekly\s*off)?$/i;

function isValidTimeValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  const formatted = formatTimeCell(value);
  if (!formatted) return true;
  return TIME_RE.test(formatted);
}

function displayTime(value: unknown): string {
  return formatTimeCell(value) ?? (value == null || value === "" ? "" : String(value));
}

export type BuildAttendancePreviewInput = {
  previewId: string;
  fileName: string;
  fileSize: number;
  format: AttendanceImportFormat;
  reportType: AttendanceReportType;
  formAttendanceDate: Date;
  rows: AttendanceImportRow[];
};

/**
 * Validate parsed rows against the live employee/attendance tables (batched).
 * Does not write. Does not re-parse.
 */
export async function buildAttendanceImportPreview(
  input: BuildAttendancePreviewInput
): Promise<AttendanceImportPreview> {
  const datesFromFile = input.reportType === "PDF_SUMMARY";
  const formIso = toISODate(startOfDay(input.formAttendanceDate));

  const codes = [
    ...new Set(
      input.rows
        .map((r) => r.employeeCode.trim())
        .filter((c) => c.length > 0)
    ),
  ];

  const employees = codes.length
    ? await prisma.employee.findMany({
        where: { employeeCode: { in: codes } },
        select: { id: true, employeeCode: true },
      })
    : [];
  const employeeByCode = new Map(employees.map((e) => [e.employeeCode, e]));

  const resolvedPairs: { rowIndex: number; employeeId: number; date: Date; dateIso: string }[] =
    [];

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    const code = row.employeeCode.trim();
    const emp = code ? employeeByCode.get(code) : undefined;
    if (!emp) continue;
    try {
      const date = resolveImportAttendanceDate(row, input.formAttendanceDate);
      if (Number.isNaN(date.getTime())) continue;
      resolvedPairs.push({
        rowIndex: i,
        employeeId: emp.id,
        date: startOfDay(date),
        dateIso: toISODate(startOfDay(date)),
      });
    } catch {
      // handled per-row below
    }
  }

  const employeeIds = [...new Set(resolvedPairs.map((p) => p.employeeId))];
  const dateValues = [...new Set(resolvedPairs.map((p) => p.dateIso))].map((iso) =>
    startOfDay(new Date(`${iso}T00:00:00`))
  );

  const existingRecords =
    employeeIds.length > 0 && dateValues.length > 0
      ? await prisma.attendanceRecord.findMany({
          where: {
            employeeId: { in: employeeIds },
            attendanceDate: { in: dateValues },
          },
          select: { employeeId: true, attendanceDate: true },
        })
      : [];

  const existingKeys = new Set(
    existingRecords.map(
      (r) => `${r.employeeId}:${toISODate(startOfDay(r.attendanceDate))}`
    )
  );

  const previewRows: AttendancePreviewRow[] = [];
  const warnings: AttendanceImportIssue[] = [];
  const errors: AttendanceImportIssue[] = [];
  const dateSet = new Set<string>();
  const employeeSet = new Set<string>();

  let validRows = 0;
  let duplicateRows = 0;
  let unknownEmployees = 0;
  let importableRows = 0;

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    const messages: string[] = [];
    let status: AttendancePreviewValidationStatus = "valid";
    let importable = true;

    const code = row.employeeCode.trim();
    if (!code) {
      status = "error";
      importable = false;
      messages.push("Missing employee code");
      errors.push({
        code: "missing_employee_code",
        message: `Row ${i + 1}: missing employee code`,
        rowIndex: i,
      });
    } else {
      employeeSet.add(code);
    }

    let dateIso: string | null = null;
    let resolvedDate: Date | null = null;
    if (datesFromFile && !row.attendanceDate) {
      status = "error";
      importable = false;
      messages.push("Missing attendance date from Summary PDF");
      errors.push({
        code: "missing_attendance_date",
        message: `Row ${i + 1} (${code || "?"}): missing attendance date`,
        rowIndex: i,
        employeeCode: code || undefined,
      });
    } else {
      resolvedDate = resolveImportAttendanceDate(row, input.formAttendanceDate);
      if (Number.isNaN(resolvedDate.getTime())) {
        status = "error";
        importable = false;
        messages.push("Invalid attendance date");
        errors.push({
          code: "invalid_date",
          message: `Row ${i + 1} (${code || "?"}): invalid attendance date`,
          rowIndex: i,
          employeeCode: code || undefined,
        });
      } else {
        dateIso = toISODate(startOfDay(resolvedDate));
        dateSet.add(dateIso);
      }
    }

    if (code && !employeeByCode.has(code)) {
      unknownEmployees++;
      if (status === "valid") status = "warning";
      messages.push("Unknown employee — import will auto-create with login");
      warnings.push({
        code: "unknown_employee_auto_create",
        message: `${code}: will be created on import (${code.toLowerCase()}@zebl.com)`,
        rowIndex: i,
        employeeCode: code,
      });
    }

    if (code && resolvedDate && !Number.isNaN(resolvedDate.getTime())) {
      const emp = employeeByCode.get(code);
      if (emp) {
        const key = `${emp.id}:${toISODate(startOfDay(resolvedDate))}`;
        if (existingKeys.has(key)) {
          duplicateRows++;
          if (status === "valid" || status === "warning") status = "duplicate";
          messages.push("Duplicate attendance for this employee and date — will be skipped");
          warnings.push({
            code: "duplicate",
            message: `${code} on ${dateIso}: already imported`,
            rowIndex: i,
            employeeCode: code,
          });
          importable = false;
        }
      }
    }

    if (!isValidTimeValue(row.inTime) || !isValidTimeValue(row.outTime)) {
      if (status === "valid") status = "warning";
      messages.push("Unusual time format");
      warnings.push({
        code: "invalid_time",
        message: `Row ${i + 1} (${code || "?"}): unusual time format`,
        rowIndex: i,
        employeeCode: code || undefined,
      });
    }

    if (row.status && row.status.trim() && !KNOWN_STATUS.test(row.status.trim())) {
      if (status === "valid") status = "warning";
      messages.push(`Unrecognized status “${row.status.trim()}”`);
      warnings.push({
        code: "invalid_status",
        message: `Row ${i + 1} (${code || "?"}): unrecognized status`,
        rowIndex: i,
        employeeCode: code || undefined,
      });
    }

    if (status === "valid") validRows++;
    if (importable) importableRows++;

    previewRows.push({
      rowIndex: i,
      employeeCode: code,
      employeeName: row.employeeName || "",
      attendanceDate: dateIso,
      shift: row.shift || "",
      inTime: displayTime(row.inTime),
      outTime: displayTime(row.outTime),
      status: row.status || "",
      workDuration: row.workDuration || "",
      validationStatus: status,
      messages,
      importable,
    });
  }

  if (input.rows.length === 0) {
    errors.push({
      code: "no_rows",
      message: "No attendance rows were found in the file.",
    });
  }

  const summary: AttendanceImportPreviewSummary = {
    totalRows: input.rows.length,
    validRows,
    duplicateRows,
    unknownEmployees,
    warnings: warnings.length,
    errors: errors.length,
    importableRows,
    employeesDetected: employeeSet.size,
    datesDetected: dateSet.size,
  };

  const canConfirm =
    importableRows > 0 &&
    !errors.some((e) => e.code === "no_rows" || e.code === "all_unknown_employees");

  return {
    previewId: input.previewId,
    meta: {
      fileName: input.fileName,
      fileSize: input.fileSize,
      format: input.format,
      reportType: input.reportType,
      formAttendanceDate: datesFromFile ? null : formIso,
      datesFromFile,
    },
    reportType: input.reportType,
    rows: previewRows,
    summary,
    warnings: dedupeIssues(warnings),
    errors: dedupeIssues(errors),
    canConfirm,
  };
}

function dedupeIssues(issues: AttendanceImportIssue[]): AttendanceImportIssue[] {
  const seen = new Set<string>();
  const out: AttendanceImportIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.code}:${issue.employeeCode ?? ""}:${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}
