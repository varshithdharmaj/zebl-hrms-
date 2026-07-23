import type { LeaveWorkflowStatus } from "@/generated/prisma/client";
import { StatusBadge } from "@/components/ui/status-badge";
import { displayStatusLabel } from "@/lib/workflow/workflow-status";

export function WorkflowStatusBadge({
  status,
  className,
}: {
  status: LeaveWorkflowStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      status={displayStatusLabel(status)}
      className={className}
    />
  );
}
