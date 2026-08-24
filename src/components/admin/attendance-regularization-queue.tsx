"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  approveRegularizationAction,
  rejectRegularizationAction,
  type ActionState,
} from "@/actions/attendance-regularization";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatTimeAmPm } from "@/lib/attendance-shift";
import type { HrRegularizationRequestDto } from "@/lib/attendance/regularization/regularization-service";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  missing_check_in: "Missing check-in",
  missing_check_out: "Missing check-out",
  missing_both: "Missing both",
  incorrect_check_in: "Incorrect check-in",
  incorrect_check_out: "Incorrect check-out",
  attendance_missing: "Attendance missing",
  device_failure: "Device failure",
};

const TABS: { key: "pending" | "approved" | "rejected" | "cancelled"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
];

const initialState: ActionState = {};

type Snapshot = {
  checkIn?: string | null;
  checkOut?: string | null;
  status?: string;
};

function ReviewForm({ request }: { request: HrRegularizationRequestDto }) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveRegularizationAction,
    initialState
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectRegularizationAction,
    initialState
  );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      {(approveState.error || rejectState.error) && (
        <p className="text-sm text-danger">{approveState.error || rejectState.error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <form action={approveAction} className="space-y-2">
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="expectedVersion" value={request.version} />
          <Textarea
            name="reviewComment"
            placeholder="Optional approval note"
            className="min-h-[60px] text-sm"
          />
          <Button type="submit" size="sm" disabled={approvePending || rejectPending}>
            {approvePending ? "Approving…" : "Approve"}
          </Button>
        </form>
        <form action={rejectAction} className="space-y-2">
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="expectedVersion" value={request.version} />
          <Textarea
            name="reviewComment"
            placeholder="Rejection reason (required, min 10 characters)"
            required
            minLength={10}
            className="min-h-[60px] text-sm"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={approvePending || rejectPending}
          >
            {rejectPending ? "Rejecting…" : "Reject"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function RequestCard({ request }: { request: HrRegularizationRequestDto }) {
  const snapshot = (request.snapshotBefore ?? {}) as Snapshot;

  return (
    <div className="space-y-4 border-b border-border px-5 py-5 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">
            {request.employeeName}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({request.employeeCode})
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {formatDate(request.attendanceDate)} · {REQUEST_TYPE_LABELS[request.requestType] ?? request.requestType}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Before (derived)
          </p>
          <p>In: {formatTimeAmPm(snapshot.checkIn ?? null)}</p>
          <p>Out: {formatTimeAmPm(snapshot.checkOut ?? null)}</p>
          <p>Status: {snapshot.status ?? "Absent"}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Requested
          </p>
          <p>In: {formatTimeAmPm(request.requestedCheckIn)}</p>
          <p>Out: {formatTimeAmPm(request.requestedCheckOut)}</p>
          {request.checkOutNextDay && <p className="text-xs text-muted-foreground">Overnight (next-day checkout)</p>}
        </div>
      </div>

      <p className="text-sm">
        <span className="font-medium text-foreground">Reason: </span>
        {request.reason}
      </p>

      <p className="text-xs text-muted-foreground">
        Submitted {formatDate(request.submittedAt)}
        {request.reviewedAt && (
          <>
            {" "}
            · Reviewed {formatDate(request.reviewedAt)} by {request.reviewedBy}
          </>
        )}
      </p>
      {request.reviewComment && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Review comment: </span>
          {request.reviewComment}
        </p>
      )}

      {request.status === "pending" && <ReviewForm request={request} />}
    </div>
  );
}

export function AttendanceRegularizationQueue({
  requests,
  activeStatus,
}: {
  requests: HrRegularizationRequestDto[];
  activeStatus: string;
}) {
  return (
    <SectionCard title="Requests" noPadding>
      <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={tab.key === activeStatus ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/admin/attendance/regularization?status=${tab.key}`}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="p-10">
          <EmptyState
            icon={CalendarClock}
            title="No requests"
            description="No regularisation requests match this filter."
          />
        </div>
      ) : (
        requests.map((r) => <RequestCard key={r.id} request={r} />)
      )}
    </SectionCard>
  );
}
