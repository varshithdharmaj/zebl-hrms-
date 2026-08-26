import type { ExecutiveDashboardPayload } from "@/lib/analytics/analytics-types";

export function AnalyticsCards({ data }: { data: ExecutiveDashboardPayload }) {
  const cards = [
    { label: "Attendance rate", value: `${data.workforceHealth.attendanceRate}%` },
    { label: "Pending approvals", value: String(data.workforceHealth.pendingApprovals) },
    { label: "Open anomalies", value: String(data.workforceHealth.openAnomalies) },
    {
      label: "Approval turnaround Δ",
      value: `${data.trends.approvalTurnaroundDeltaPct > 0 ? "+" : ""}${data.trends.approvalTurnaroundDeltaPct}%`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-border bg-card p-4 shadow-card"
        >
          <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
