"use client";

import { ApprovalStepStatus } from "@prisma/client";
import { getApproverRoleLabel } from "@/lib/workflow/approver-role-labels";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/workflow-status";
import type { LeaveWorkflowStatus } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type TimelineStep = {
  id: number;
  stepOrder: number;
  approverRole: string;
  approverName: string | null;
  status: ApprovalStepStatus | string;
  actedAt: Date | null;
  comment: string | null;
};

export function LeaveWorkflowTimeline({
  workflowStatus,
  submittedAt,
  rejectionReason,
  steps,
  currentStepId,
}: {
  workflowStatus: LeaveWorkflowStatus;
  submittedAt: Date | null;
  rejectionReason: string | null;
  steps: TimelineStep[];
  currentStepId: number | null;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        Status: {WORKFLOW_STATUS_LABELS[workflowStatus]}
      </p>

      <ol className="relative space-y-0 border-l border-border pl-4">
        <li className="pb-4">
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
          <p className="text-sm font-medium">Submitted</p>
          <p className="text-xs text-muted-foreground">
            {submittedAt ? formatDate(submittedAt) : "—"}
          </p>
        </li>

        {steps.map((step) => {
          const isCurrent = step.id === currentStepId;
          const dotClass =
            step.status === ApprovalStepStatus.approved
              ? "bg-success"
              : step.status === ApprovalStepStatus.rejected
                ? "bg-danger"
                : step.status === ApprovalStepStatus.skipped
                  ? "bg-muted"
                  : isCurrent
                    ? "bg-warning ring-2 ring-warning/30"
                    : "bg-border";

          return (
            <li key={step.id} className="pb-4">
              <span
                className={cn("absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full", dotClass)}
              />
              <p className="text-sm font-medium">
                {getApproverRoleLabel(step.approverRole)}
                {step.approverName ? ` — ${step.approverName}` : ""}
                {isCurrent && step.status === ApprovalStepStatus.pending && (
                  <span className="ml-2 text-xs font-normal text-warning">(current)</span>
                )}
              </p>
              <p className="text-xs capitalize text-muted-foreground">{step.status}</p>
              {step.actedAt && (
                <p className="text-xs text-muted-foreground">{formatDate(step.actedAt)}</p>
              )}
              {step.comment && (
                <p className="mt-1 text-xs text-foreground/80">&ldquo;{step.comment}&rdquo;</p>
              )}
            </li>
          );
        })}
      </ol>

      {rejectionReason && (
        <p className="rounded-lg border border-danger/20 bg-danger-muted px-3 py-2 text-sm text-danger">
          Rejection: {rejectionReason}
        </p>
      )}
    </div>
  );
}
