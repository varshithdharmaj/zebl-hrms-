import * as XLSX from "xlsx";
import type { ExecutiveDashboardPayload } from "@/lib/analytics/analytics-types";

export function buildExecutiveExcel(snapshot: ExecutiveDashboardPayload): Buffer {
  const wb = XLSX.utils.book_new();

  const summary = [
    ["Zebl AMS — Executive Summary"],
    ["Generated", snapshot.generatedAt],
    ["Attendance rate %", snapshot.workforceHealth.attendanceRate],
    ["Leave utilization (days)", snapshot.workforceHealth.leaveUtilization],
    ["Pending approvals", snapshot.workforceHealth.pendingApprovals],
    ["Open anomalies", snapshot.workforceHealth.openAnomalies],
    ["Approval turnaround delta %", snapshot.trends.approvalTurnaroundDeltaPct],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  const deptSheet = XLSX.utils.json_to_sheet(snapshot.departmentComparison);
  XLSX.utils.book_append_sheet(wb, deptSheet, "Departments");

  const anomalySheet = XLSX.utils.json_to_sheet(snapshot.anomalies);
  XLSX.utils.book_append_sheet(wb, anomalySheet, "Anomalies");

  const recSheet = XLSX.utils.json_to_sheet(
    snapshot.recommendations.map((r) => ({
      category: r.category,
      priority: r.priority,
      title: r.title,
      detail: r.detail,
      rationale: r.rationale,
    }))
  );
  XLSX.utils.book_append_sheet(wb, recSheet, "Recommendations");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildAttendanceExcel(rows: Record<string, string | number>[]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Attendance");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
