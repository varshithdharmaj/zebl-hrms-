"use client";

import { useActionState } from "react";
import { withdrawLeaveAction, type WorkflowActionState } from "@/actions/workflow";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { ApprovalBadge } from "@/components/workflow/approval-badge";
import { LeaveWorkflowTimeline } from "@/components/workflow/leave-workflow-timeline";
import { Button } from "@/components/ui/button";
import { formatLeaveDays } from "@/lib/leave-types";
import { formatDate } from "@/lib/utils";
import { canActOnWorkflow } from "@/lib/leave-status";
import type { LeaveWorkflowStatus } from "@prisma/client";

type Leave = {
  id: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: string;
  workflowStatus: LeaveWorkflowStatus;
  rejectionReason: string | null;
  submittedAt: Date | null;
  currentStepId: number | null;
  createdAt: Date;
  approvalSteps: {
    id: number;
    stepOrder: number;
    approverRole: string;
    status: string;
    actedAt: Date | null;
    comment: string | null;
    approver: { name: string } | null;
  }[];
};

const withdrawInitial: WorkflowActionState = {};

export function EmployeeLeaveTable({ leaves }: { leaves: Leave[] }) {
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(
    withdrawLeaveAction,
    withdrawInitial
  );

  return (
    <div className="space-y-2">
      {withdrawState.error && (
        <p className="text-sm text-danger">{withdrawState.error}</p>
      )}
      {withdrawState.success && (
        <p className="text-sm text-success">{withdrawState.success}</p>
      )}
      <DataTable columns={["Type", "From", "To", "Days", "Reason", "Status", ""]}>
        {leaves.map((leave) => {
          const steps = leave.approvalSteps.map((s) => ({
            id: s.id,
            stepOrder: s.stepOrder,
            approverRole: s.approverRole,
            approverName: s.approver?.name ?? null,
            status: s.status,
            actedAt: s.actedAt,
            comment: s.comment,
          }));

          return (
            <DataTableRow key={leave.id}>
              <DataTableCell>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {leave.leaveType}
                </span>
              </DataTableCell>
              <DataTableCell>{formatDate(leave.startDate)}</DataTableCell>
              <DataTableCell>{formatDate(leave.endDate)}</DataTableCell>
              <DataTableCell className="tabular-nums">{formatLeaveDays(leave.days)}</DataTableCell>
              <DataTableCell>{leave.reason}</DataTableCell>
              <DataTableCell>
                <ApprovalBadge workflowStatus={leave.workflowStatus} />
                {leave.rejectionReason && (
                  <p className="mt-1 text-xs text-danger">{leave.rejectionReason}</p>
                )}
              </DataTableCell>
              <DataTableCell>
                {canActOnWorkflow(leave.workflowStatus) && (
                  <form action={withdrawAction}>
                    <input type="hidden" name="leaveId" value={leave.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={withdrawPending}
                    >
                      Withdraw
                    </Button>
                  </form>
                )}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Track progress
                  </summary>
                  <div className="mt-2 min-w-[200px]">
                    <LeaveWorkflowTimeline
                      workflowStatus={leave.workflowStatus}
                      submittedAt={leave.submittedAt}
                      rejectionReason={leave.rejectionReason}
                      steps={steps}
                      currentStepId={leave.currentStepId}
                    />
                  </div>
                </details>
              </DataTableCell>
            </DataTableRow>
          );
        })}
      </DataTable>
    </div>
  );
}
