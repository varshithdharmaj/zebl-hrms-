"use server";

import { requireHROrSuperAdminSession, requireSuperAdminSession } from "@/lib/auth-guards";
import {
  getLoginHistoryExportRows,
  type LoginHistoryFilters,
} from "@/lib/security/login-history-service";
import { isSuperAdmin } from "@/lib/permissions";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function exportData(rows: Awaited<ReturnType<typeof getLoginHistoryExportRows>>) {
  return rows.map((row) => ({
    Employee: row.employee?.name ?? row.attemptedEmail ?? row.user?.email ?? "Unknown",
    "Employee Code": row.employee?.employeeCode ?? "",
    Department: row.employee?.department ?? "",
    Role: row.user?.role ?? "",
    "Login Time": row.loginAt.toISOString(),
    "Logout Time": row.logoutAt?.toISOString() ?? "",
    "Duration (seconds)": row.sessionDuration ?? "",
    Browser: [row.browser, row.browserVersion].filter(Boolean).join(" "),
    Device: row.device ?? "",
    OS: row.operatingSystem ?? "",
    IP: row.ipAddress ?? "",
    Status: row.status,
    Reason: row.failureReason ?? "",
  }));
}

export async function exportLoginHistoryCsvAction(filters: LoginHistoryFilters) {
  const actor = await requireHROrSuperAdminSession();
  const rows = exportData(
    await getLoginHistoryExportRows(filters, isSuperAdmin(actor.role))
  );
  const headers = Object.keys(rows[0] ?? {
    Employee: "",
    "Employee Code": "",
    Department: "",
    Role: "",
    "Login Time": "",
    "Logout Time": "",
    "Duration (seconds)": "",
    Browser: "",
    Device: "",
    OS: "",
    IP: "",
    Status: "",
    Reason: "",
  });
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      headers
        .map((header) => csvCell(row[header as keyof typeof row]))
        .join(",")
    ),
  ].join("\r\n");
  return { csv };
}

export async function exportLoginHistoryExcelAction(filters: LoginHistoryFilters) {
  await requireSuperAdminSession();
  const rows = exportData(await getLoginHistoryExportRows(filters, true));
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Login History");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { base64: buffer.toString("base64") };
}
