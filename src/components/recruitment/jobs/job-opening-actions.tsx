"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  archiveJobOpeningAction,
  changeJobOpeningStatusAction,
  closeJobOpeningAction,
  reopenJobOpeningAction,
  type RecruitmentJobActionState,
} from "@/actions/recruitment-jobs";
import type { JobOpeningStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { isJobStatusTransitionAllowed } from "@/lib/recruitment/job/status-transitions";

const initial: RecruitmentJobActionState = {};

export function JobOpeningActions({
  jobId,
  status,
  deletedAt,
}: {
  jobId: string;
  status: JobOpeningStatus;
  deletedAt: Date | string | null;
}) {
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveJobOpeningAction,
    initial
  );
  const [closeState, closeAction, closePending] = useActionState(closeJobOpeningAction, initial);
  const [reopenState, reopenAction, reopenPending] = useActionState(
    reopenJobOpeningAction,
    initial
  );
  const [statusState, statusAction, statusPending] = useActionState(
    changeJobOpeningStatusAction,
    initial
  );

  const error =
    archiveState.error || closeState.error || reopenState.error || statusState.error;
  const success =
    archiveState.success || closeState.success || reopenState.success || statusState.success;
  const pending = archivePending || closePending || reopenPending || statusPending;
  const archived = Boolean(deletedAt);

  return (
    <div className="space-y-3">
      {error && <ErrorAlert message={error} />}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/recruitment/jobs/${jobId}/edit`}>Edit</Link>
        </Button>

        {!archived && isJobStatusTransitionAllowed(status, "open") && status !== "open" && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={jobId} />
            <input type="hidden" name="toStatus" value="open" />
            <Button type="submit" size="sm" loading={pending}>
              Open
            </Button>
          </form>
        )}

        {!archived && isJobStatusTransitionAllowed(status, "on_hold") && status !== "on_hold" && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={jobId} />
            <input type="hidden" name="toStatus" value="on_hold" />
            <input type="hidden" name="reason" value="Placed on hold" />
            <Button type="submit" variant="secondary" size="sm" loading={pending}>
              Hold
            </Button>
          </form>
        )}

        {!archived && isJobStatusTransitionAllowed(status, "filled") && status !== "filled" && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={jobId} />
            <input type="hidden" name="toStatus" value="filled" />
            <Button type="submit" variant="secondary" size="sm" loading={pending}>
              Mark filled
            </Button>
          </form>
        )}

        {!archived && status !== "closed" && (
          <form action={closeAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={jobId} />
            <input
              name="reason"
              required
              placeholder="Close reason"
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
              aria-label="Close reason"
            />
            <Button type="submit" variant="destructive" size="sm" loading={pending}>
              Close
            </Button>
          </form>
        )}

        {(archived || status === "closed" || status === "filled") && (
          <form action={reopenAction}>
            <input type="hidden" name="id" value={jobId} />
            <input type="hidden" name="toStatus" value="open" />
            <Button type="submit" size="sm" loading={pending}>
              Reopen
            </Button>
          </form>
        )}

        {!archived && (
          <form action={archiveAction}>
            <input type="hidden" name="id" value={jobId} />
            <Button type="submit" variant="outline" size="sm" loading={pending}>
              Archive
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
