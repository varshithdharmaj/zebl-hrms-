"use client";

import { useActionState, useState } from "react";
import { rejectLeaveStepAction, type WorkflowActionState } from "@/actions/workflow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorAlert } from "@/components/ui/error-alert";
import { MIN_REJECTION_COMMENT_LENGTH } from "@/lib/workflow/workflow-types";

const initialState: WorkflowActionState = {};

export function RejectionDialog({
  leaveId,
  version,
  triggerLabel = "Reject",
  isOverride = false,
}: {
  leaveId: number;
  version: number;
  triggerLabel?: string;
  isOverride?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(rejectLeaveStepAction, initialState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isOverride ? "Override reject leave request" : "Reject leave request"}
          </DialogTitle>
          <DialogDescription>
            {isOverride
              ? "Superadmin override: rejecting outside the normal approver step. A comment is required."
              : `A comment is required (minimum ${MIN_REJECTION_COMMENT_LENGTH} characters).`}
          </DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          className="space-y-4"
          onSubmit={() => {
            if (state.success) setOpen(false);
          }}
        >
          <input type="hidden" name="leaveId" value={leaveId} />
          <input type="hidden" name="version" value={version} />
          {state.error && <ErrorAlert message={state.error} />}
          {state.success && (
            <p className="text-sm text-success">{state.success}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor={`reject-comment-${leaveId}`}>Reason for rejection</Label>
            <Textarea
              id={`reject-comment-${leaveId}`}
              name="comment"
              required
              minLength={MIN_REJECTION_COMMENT_LENGTH}
              rows={4}
              placeholder="Explain why this request is rejected…"
            />
          </div>
          <Button type="submit" variant="destructive" disabled={pending} className="w-full">
            {pending ? "Rejecting…" : "Confirm rejection"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
