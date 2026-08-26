"use client";

import Link from "next/link";
import { SectionCard } from "@/components/ui/section-card";
import { formatDate } from "@/lib/utils";
import type { getOperationsDashboard } from "@/lib/operations/ops-queries";

type OpsData = Awaited<ReturnType<typeof getOperationsDashboard>>;

export function AdminOperationsView({ data }: { data: OpsData }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Notification queue" value={data.queueDepth} warn={data.queueDepth > 100} />
        <Metric
          label="Failed notifications"
          value={data.notificationStats.failed}
          warn={data.notificationStats.failed > 0}
        />
        <Metric label="Pending integration jobs" value={data.pendingIntegrationJobs} />
        <Metric
          label="Stuck workflows"
          value={data.workflowStuckCount}
          warn={data.workflowStuckCount > 0}
        />
      </div>

      <SectionCard title="Worker health" description="Last heartbeat from background workers">
        {data.workers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No worker heartbeats yet. Run workers with{" "}
            <code className="text-xs">npm run notifications:process</code> or enable{" "}
            <code className="text-xs">WORKER_LOOP=true</code>.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.workers.map((w: OpsData["workers"][number]) => (
              <li key={w.workerName} className="flex flex-wrap justify-between gap-2 py-3">
                <span className="font-medium">{w.workerName}</span>
                <span className={w.stale ? "text-danger" : "text-muted-foreground"}>
                  {w.status} · last beat {formatDate(w.lastBeatAt)}
                  {w.lastError ? ` · ${w.lastError}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Integration health">
          <dl className="space-y-2 text-sm">
            <Row label="Graph status" value={data.integrationHealth.graphStatus ?? "unknown"} />
            <Row
              label="Last Graph check"
              value={
                data.integrationHealth.graphCheckedAt
                  ? formatDate(data.integrationHealth.graphCheckedAt)
                  : "never"
              }
            />
            <Row
              label="Calendar sync"
              value={data.integrationHealth.calendarSyncEnabled ? "enabled" : "disabled"}
            />
            <Row
              label="Org sync"
              value={data.integrationHealth.orgSyncEnabled ? "enabled" : "disabled"}
            />
            <Row label="Escalations (7d)" value={String(data.escalationBacklog)} />
          </dl>
          <Link href="/admin/integrations" className="mt-3 inline-block text-sm text-primary hover:underline">
            Integration settings →
          </Link>
        </SectionCard>

        <SectionCard title="Queue alerts">
          <ul className="space-y-2 text-sm">
            {data.stuckProcessingNotifications > 0 && (
              <li className="text-danger">
                {data.stuckProcessingNotifications} notification(s) stuck in processing
              </li>
            )}
            {data.workflowOrphanCount > 0 && (
              <li className="text-danger">
                {data.workflowOrphanCount} workflow pointer issue(s) detected
              </li>
            )}
            {data.stuckProcessingNotifications === 0 && data.workflowOrphanCount === 0 && (
              <li className="text-muted-foreground">No critical queue alerts.</li>
            )}
          </ul>
          <Link href="/admin/notifications" className="mt-3 inline-block text-sm text-primary hover:underline">
            Notification queue →
          </Link>
        </SectionCard>
      </div>

      {data.failedJobs.length > 0 && (
        <SectionCard title="Failed integration jobs" description="Dead-letter / max attempts reached">
          <ul className="divide-y divide-border text-sm">
            {data.failedJobs.map((j: OpsData["failedJobs"][number]) => (
              <li key={j.id} className="py-3">
                <span className="font-mono text-xs">{j.jobType}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                {j.attempts} attempts
                {j.lastError && (
                  <p className="mt-1 truncate text-danger">{j.lastError}</p>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {data.workflowIssues.length > 0 && (
        <SectionCard title="Workflow integrity" description="Automated scan of active leave workflows">
          <ul className="divide-y divide-border text-sm">
            {data.workflowIssues.map((issue: OpsData["workflowIssues"][number]) => (
              <li key={`${issue.leaveRequestId}-${issue.code}`} className="py-2">
                <Link href="/admin/leaves" className="text-primary hover:underline">
                  Leave #{issue.leaveRequestId}
                </Link>
                <span className="mx-2 text-muted-foreground">{issue.code}</span>
                {issue.message}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${warn ? "text-danger" : ""}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
