"use client";

import { useActionState } from "react";
import {
  runGraphHealthCheckAction,
  runIntegrationJobsAction,
  queueOrgSyncAction,
  type IntegrationActionState,
} from "@/actions/integrations";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { formatDate } from "@/lib/utils";

const initial: IntegrationActionState = {};

export function IntegrationOpsPanel({
  graphHealthStatus,
  graphHealthAt,
}: {
  graphHealthStatus: string | null;
  graphHealthAt: Date | null;
}) {
  const [healthState, healthAction, healthPending] = useActionState(
    runGraphHealthCheckAction,
    initial
  );
  const [jobsState, jobsAction, jobsPending] = useActionState(
    runIntegrationJobsAction,
    initial
  );
  const [orgState, orgAction, orgPending] = useActionState(queueOrgSyncAction, initial);

  return (
    <SectionCard title="Operations" description="Health checks and background job controls">
      <dl className="mb-4 space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Graph health</dt>
          <dd className="font-medium">{graphHealthStatus ?? "Not checked"}</dd>
        </div>
        {graphHealthAt && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Last check</dt>
            <dd>{formatDate(graphHealthAt)}</dd>
          </div>
        )}
      </dl>

      {(healthState.success || healthState.error) && (
        <p
          className={`mb-3 text-sm ${healthState.error ? "text-destructive" : "text-success"}`}
        >
          {healthState.success ?? healthState.error}
        </p>
      )}
      {(jobsState.success || jobsState.error) && (
        <p className={`mb-3 text-sm ${jobsState.error ? "text-destructive" : "text-success"}`}>
          {jobsState.success ?? jobsState.error}
        </p>
      )}
      {(orgState.success || orgState.error) && (
        <p className={`mb-3 text-sm ${orgState.error ? "text-destructive" : "text-success"}`}>
          {orgState.success ?? orgState.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <form action={healthAction}>
          <Button type="submit" variant="outline" size="sm" disabled={healthPending}>
            {healthPending ? "Checking…" : "Check Graph API"}
          </Button>
        </form>
        <form action={jobsAction}>
          <Button type="submit" variant="outline" size="sm" disabled={jobsPending}>
            {jobsPending ? "Running…" : "Process jobs"}
          </Button>
        </form>
        <form action={orgAction}>
          <Button type="submit" variant="outline" size="sm" disabled={orgPending}>
            {orgPending ? "Queuing…" : "Queue org sync"}
          </Button>
        </form>
      </div>
    </SectionCard>
  );
}
