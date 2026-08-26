"use client";

import { useEffect, useState } from "react";
import type { ApprovalInsightPayload } from "@/lib/analytics/analytics-types";

export function ApprovalInsightsPanel({ leaveId }: { leaveId: number }) {
  const [insights, setInsights] = useState<ApprovalInsightPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/analytics/approval-insights?leaveId=${leaveId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setInsights(data as ApprovalInsightPayload | null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leaveId]);

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading decision support…</p>;
  }
  if (!insights) return null;

  return (
    <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
      <p className="font-semibold text-foreground">Approval intelligence (decision support)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Human approval required — insights only, not auto-approval.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          12m history: {insights.history.approvedLeavesLast12m} approved,{" "}
          {insights.history.rejectedLeavesLast12m} rejected
        </li>
        <li>Workload signal: {insights.workload.burnoutIndicator} — {insights.workload.rationale}</li>
        {insights.teamImpact.staffingWarning && <li>{insights.teamImpact.staffingWarning}</li>}
        {insights.recommendations.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
