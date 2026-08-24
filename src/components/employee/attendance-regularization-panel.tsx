"use client";

import { useActionState, useState } from "react";
import {
  cancelRegularizationAction,
  submitRegularizationAction,
  type ActionState,
} from "@/actions/attendance-regularization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { OwnRegularizationRequestDto } from "@/lib/attendance/regularization/regularization-service";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  missing_check_in: "Missing check-in",
  missing_check_out: "Missing check-out",
  missing_both: "Missing both check-in and check-out",
  incorrect_check_in: "Incorrect check-in time",
  incorrect_check_out: "Incorrect check-out time",
  attendance_missing: "Attendance missing for the day",
  device_failure: "Biometric device failure",
};

const NEEDS_CHECK_IN = new Set([
  "missing_check_in",
  "incorrect_check_in",
  "missing_both",
  "attendance_missing",
  "device_failure",
]);
const NEEDS_CHECK_OUT = new Set(["missing_check_out", "incorrect_check_out", "missing_both"]);

const initialState: ActionState = {};

function RequestForm() {
  const [state, formAction, pending] = useActionState(submitRegularizationAction, initialState);
  const [requestType, setRequestType] = useState("missing_check_in");

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm font-medium text-success">
          {state.success}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="attendanceDate">Attendance date</Label>
          <Input id="attendanceDate" name="attendanceDate" type="date" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="requestType">What went wrong?</Label>
          <select
            id="requestType"
            name="requestType"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            className="flex h-9.5 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {NEEDS_CHECK_IN.has(requestType) && (
          <div className="space-y-1.5">
            <Label htmlFor="requestedCheckIn">Actual check-in time</Label>
            <Input id="requestedCheckIn" name="requestedCheckIn" type="time" required />
          </div>
        )}

        {NEEDS_CHECK_OUT.has(requestType) && (
          <div className="space-y-1.5">
            <Label htmlFor="requestedCheckOut">Actual check-out time</Label>
            <Input id="requestedCheckOut" name="requestedCheckOut" type="time" required />
          </div>
        )}
      </div>

      {NEEDS_CHECK_OUT.has(requestType) && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="checkOutNextDay" className="h-4 w-4 rounded border-input" />
          Check-out was on the next calendar day (overnight shift)
        </label>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="reason">Reason</Label>
        <Textarea
          id="reason"
          name="reason"
          required
          minLength={10}
          maxLength={1000}
          placeholder="Explain what happened (at least 10 characters)."
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}

function RequestRow({ request }: { request: OwnRegularizationRequestDto }) {
  const [state, formAction, pending] = useActionState(cancelRegularizationAction, initialState);

  return (
    <div className="flex flex-col gap-2 border-b border-border px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{formatDate(request.attendanceDate)}</span>
          <StatusBadge status={request.status} />
          <span className="text-xs text-muted-foreground">
            {REQUEST_TYPE_LABELS[request.requestType] ?? request.requestType}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{request.reason}</p>
        {request.reviewComment && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">HR comment: </span>
            {request.reviewComment}
          </p>
        )}
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
      </div>

      {request.status === "pending" && (
        <form action={formAction}>
          <input type="hidden" name="requestId" value={request.id} />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Cancelling…" : "Cancel"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function AttendanceRegularizationPanel({
  requests,
}: {
  requests: OwnRegularizationRequestDto[];
}) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Request a correction"
        description="Missed a punch or see incorrect check-in/out data? Submit a regularisation request for HR review."
      >
        <RequestForm />
      </SectionCard>

      <SectionCard title="Your requests" noPadding>
        {requests.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={CalendarClock}
              title="No regularisation requests"
              description="Requests you submit will appear here with their review status."
            />
          </div>
        ) : (
          requests.map((r) => <RequestRow key={r.id} request={r} />)
        )}
      </SectionCard>
    </div>
  );
}
