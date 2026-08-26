"use client";

import { useActionState } from "react";
import { AnalyticsCards } from "@/components/analytics/analytics-cards";
import {
  BottleneckPanel,
  DepartmentComparisonChart,
} from "@/components/analytics/trend-charts";
import { WorkforceHeatmap } from "@/components/analytics/workforce-heatmap";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { runAnalyticsNowAction, type AnalyticsActionState } from "@/actions/analytics";
import type { ExecutiveDashboardPayload } from "@/lib/analytics/analytics-types";

const initial: AnalyticsActionState = {};

export function AnalyticsDashboard({ snapshot }: { snapshot: ExecutiveDashboardPayload | null }) {
  const [state, action, pending] = useActionState(runAnalyticsNowAction, initial);

  if (!snapshot) {
    return (
      <SectionCard title="No analytics data" description="Run aggregation to populate the dashboard">
        <form action={action}>
          <Button type="submit" disabled={pending}>
            {pending ? "Running…" : "Run analytics now"}
          </Button>
        </form>
        {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
        {state.success && <p className="mt-2 text-sm text-success">{state.success}</p>}
      </SectionCard>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Snapshot generated {new Date(snapshot.generatedAt).toLocaleString("en-IN")}
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={action}>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? "Refreshing…" : "Refresh analytics"}
            </Button>
          </form>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/analytics/export?format=excel">Export Excel</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/analytics/export?format=html">Export report (HTML)</a>
          </Button>
        </div>
      </div>
      {state.success && <p className="text-sm text-success">{state.success}</p>}

      <AnalyticsCards data={snapshot} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Operational bottlenecks" description="Approval SLA and stuck workflows">
          <BottleneckPanel bottlenecks={snapshot.bottlenecks} />
        </SectionCard>
        <SectionCard title="Department comparison" description="Attendance by department">
          <DepartmentComparisonChart data={snapshot.departmentComparison} />
        </SectionCard>
      </div>

      <SectionCard title="Attendance heatmap" description="Absenteeism intensity by department">
        <WorkforceHeatmap data={snapshot.heatmap} />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Staffing & trends" description="Predictive operational signals">
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {snapshot.trends.projectedStaffingRisks.length === 0 ? (
              <li>No projected staffing risks.</li>
            ) : (
              snapshot.trends.projectedStaffingRisks.map((r) => <li key={r}>{r}</li>)
            )}
          </ul>
        </SectionCard>
        <SectionCard title="Recommendations" description="Explainable operational guidance">
          <ul className="space-y-3 text-sm">
            {snapshot.recommendations.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-3">
                <p className="font-medium text-foreground">
                  {r.title}{" "}
                  <span className="text-xs text-muted-foreground">({r.priority})</span>
                </p>
                <p className="mt-1 text-muted-foreground">{r.detail}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Open anomalies" description="Detected operational outliers">
        <ul className="space-y-2 text-sm">
          {snapshot.anomalies.map((a) => (
            <li key={a.id} className="flex gap-2 rounded-lg border border-border px-3 py-2">
              <span
                className={`shrink-0 text-xs font-semibold uppercase ${
                  a.severity === "high" ? "text-destructive" : "text-amber-600"
                }`}
              >
                {a.severity}
              </span>
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-muted-foreground">{a.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
