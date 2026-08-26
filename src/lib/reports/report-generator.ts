import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import type { ExecutiveDashboardPayload } from "@/lib/analytics/analytics-types";
import { getLatestExecutiveSnapshot } from "@/lib/analytics/analytics-engine";
import { buildExecutiveExcel } from "@/lib/reports/excel-reports";
import { buildExecutiveHtmlReport } from "@/lib/reports/pdf-reports";

export type ReportFormat = "excel" | "html";

export async function generateExecutiveReport(
  format: ReportFormat,
  actorUserId?: string
): Promise<{ data: Buffer | string; filename: string; mimeType: string }> {
  const snapshot = await getLatestExecutiveSnapshot();
  if (!snapshot) {
    throw new Error("No analytics snapshot available. Run analytics aggregation first.");
  }

  let result: { data: Buffer | string; filename: string; mimeType: string };

  if (format === "excel") {
    const buffer = buildExecutiveExcel(snapshot);
    result = {
      data: buffer,
      filename: `zebl-executive-summary-${Date.now()}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  } else {
    const html = buildExecutiveHtmlReport(snapshot);
    result = {
      data: html,
      filename: `zebl-executive-summary-${Date.now()}.html`,
      mimeType: "text/html; charset=utf-8",
    };
  }

  await writeAuditLog({
    entityType: "analytics_report",
    entityId: format,
    action: AUDIT_ACTIONS.ANALYTICS_REPORT_EXPORTED,
    actorUserId,
    metadata: { format, filename: result.filename },
  });

  return result;
}
