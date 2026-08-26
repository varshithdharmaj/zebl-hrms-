import { cn } from "@/lib/utils";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/workflow-status";
import type { LeaveWorkflowStatus } from "@prisma/client";

const styles: Record<string, string> = {
  pending_approval: "bg-warning-muted text-warning ring-1 ring-warning/15",
  submitted: "bg-warning-muted text-warning ring-1 ring-warning/15",
  approved: "bg-success-muted text-success ring-1 ring-success/15",
  rejected: "bg-danger-muted text-danger ring-1 ring-danger/15",
  withdrawn: "bg-muted text-muted-foreground ring-1 ring-border",
  cancelled: "bg-muted text-muted-foreground ring-1 ring-border",
};

export function ApprovalBadge({
  workflowStatus,
  className,
}: {
  workflowStatus: LeaveWorkflowStatus | string;
  className?: string;
}) {
  const key = String(workflowStatus);
  const label =
    WORKFLOW_STATUS_LABELS[key as LeaveWorkflowStatus] ?? key.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        styles[key] ?? "bg-muted text-muted-foreground ring-1 ring-border",
        className
      )}
    >
      {label}
    </span>
  );
}
