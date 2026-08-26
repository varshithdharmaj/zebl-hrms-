import type { ExecutiveDashboardPayload } from "@/lib/analytics/analytics-types";

export function buildExecutiveHtmlReport(snapshot: ExecutiveDashboardPayload): string {
  const recs = snapshot.recommendations
    .map(
      (r) =>
        `<li><strong>${escapeHtml(r.title)}</strong> (${r.priority}) — ${escapeHtml(r.detail)}</li>`
    )
    .join("");

  const anomalies = snapshot.anomalies
    .map(
      (a) =>
        `<li><span class="sev-${a.severity}">${escapeHtml(a.severity)}</span> ${escapeHtml(a.title)}: ${escapeHtml(a.description)}</li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Zebl AMS Executive Summary</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #0f172a; }
    h1 { font-size: 1.5rem; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1.5rem 0; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; }
    .card strong { display: block; font-size: 1.5rem; }
    ul { line-height: 1.6; }
    .sev-high { color: #dc2626; font-weight: 600; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <h1>Zebl AMS — Executive Operational Summary</h1>
  <p>Generated ${escapeHtml(snapshot.generatedAt)}</p>
  <div class="metrics">
    <div class="card"><span>Attendance rate</span><strong>${snapshot.workforceHealth.attendanceRate}%</strong></div>
    <div class="card"><span>Pending approvals</span><strong>${snapshot.workforceHealth.pendingApprovals}</strong></div>
    <div class="card"><span>Open anomalies</span><strong>${snapshot.workforceHealth.openAnomalies}</strong></div>
    <div class="card"><span>Turnaround Δ</span><strong>${snapshot.trends.approvalTurnaroundDeltaPct}%</strong></div>
  </div>
  <h2>Recommendations</h2>
  <ul>${recs || "<li>No recommendations</li>"}</ul>
  <h2>Anomalies</h2>
  <ul>${anomalies || "<li>No open anomalies</li>"}</ul>
  <p><em>Print this page to PDF for archival.</em></p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
