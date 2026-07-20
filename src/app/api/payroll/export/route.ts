import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/permissions";
import { writeAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPayrollSettings } from "@/lib/payroll/payroll-settings";
import { parsePayrollPeriodKey } from "@/lib/payroll/payroll-period";
import {
  getPayrollAttendanceSummaries,
  type PayrollAttendanceFilters,
} from "@/lib/payroll/payroll-summaries";
import { buildPayrollAttendanceExcel, toPayrollExportRow } from "@/lib/reports/payroll-excel";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateCheck = checkRateLimit(`payroll-export:${session.id}`, 10, 60 * 1000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Export rate limit exceeded. Please wait a minute." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rateCheck.retryAfterMs / 1000).toString(),
        },
      }
    );
  }

  const url = new URL(request.url);
  const settings = await getPayrollSettings();
  const period = parsePayrollPeriodKey(
    url.searchParams.get("period") ?? undefined,
    settings.payrollStartDay
  );

  const filters: PayrollAttendanceFilters = {
    shift: url.searchParams.get("shift") ?? undefined,
    hasShortfall: url.searchParams.get("shortfall") === "1",
    hasOt: url.searchParams.get("ot") === "1",
    hasLate: url.searchParams.get("late") === "1",
    hasAbsent: url.searchParams.get("absent") === "1",
    pendingDecision: url.searchParams.get("pending") === "1",
    search: url.searchParams.get("q") ?? undefined,
  };

  const rows = await getPayrollAttendanceSummaries(period, filters);
  const buffer = buildPayrollAttendanceExcel({
    periodLabel: period.label,
    generatedAt: new Date().toISOString(),
    rows: rows.map(toPayrollExportRow),
  });

  await writeAuditLog({
    entityType: "payroll_report",
    entityId: period.key,
    action: AUDIT_ACTIONS.PAYROLL_REPORT_EXPORTED,
    actorUserId: session.id,
    actorEmail: session.email,
    metadata: { rowCount: rows.length },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Payroll_Attendance_Report.xlsx"',
    },
  });
}
