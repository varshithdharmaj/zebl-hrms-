"use client";

import { approveLeaveStepAction, type WorkflowActionState } from "@/actions/workflow";
import { cancelLeaveAction } from "@/actions/workflow";
import { useActionState } from "react";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { ApprovalBadge } from "@/components/workflow/approval-badge";
import { RejectionDialog } from "@/components/workflow/rejection-dialog";
import { LeaveWorkflowTimeline } from "@/components/workflow/leave-workflow-timeline";
import { Button } from "@/components/ui/button";
import { LEAVE_TYPE_LABELS, formatLeaveDays, type LeaveType } from "@/lib/leave-types";
import { formatDate } from "@/lib/utils";
import { canActOnWorkflow } from "@/lib/leave-status";
import { LeaveWorkflowStatus } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Leave = {
  id: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: string;
  workflowStatus: LeaveWorkflowStatus;
  version: number;
  rejectionReason: string | null;
  submittedAt: Date | null;
  currentStepId: number | null;
  employee: { name: string; employeeCode: string };
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

const approveInitial: WorkflowActionState = {};
const cancelInitial: WorkflowActionState = {};

function ApproveButton({ leaveId, version }: { leaveId: number; version: number }) {
  const [state, formAction, pending] = useActionState(approveLeaveStepAction, approveInitial);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="leaveId" value={leaveId} />
      <input type="hidden" name="version" value={version} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Approve"}
      </Button>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

function CancelApprovedForm({ leaveId }: { leaveId: number }) {
  const [state, formAction, pending] = useActionState(cancelLeaveAction, cancelInitial);
  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-lg border border-border p-3">
      <input type="hidden" name="leaveId" value={leaveId} />
      <Label className="text-xs">Cancellation reason (required)</Label>
      <Input name="reason" required minLength={10} placeholder="Reason for cancellation" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel approved leave"}
      </Button>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      {state.success && <p className="text-xs text-success">{state.success}</p>}
    </form>
  );
}

export function AdminLeaveTable({ leaves }: { leaves: Leave[] }) {
  return (
    <DataTable
      columns={["Employee", "Type", "Dates", "Days", "Reason", "Status", "Actions"]}
      emptyMessage="No requests."
    >
      {leaves.map((leave) => {
        const canAct = canActOnWorkflow(leave.workflowStatus);
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
              <p className="font-semibold text-slate-900">{leave.employee.name}</p>
              <p className="text-xs text-slate-500 font-medium">{leave.employee.employeeCode}</p>
            </DataTableCell>
            <DataTableCell>
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                {leave.leaveType}
              </span>
              <p className="mt-0.5 text-xs text-slate-500">
                {LEAVE_TYPE_LABELS[leave.leaveType as LeaveType]}
              </p>
            </DataTableCell>
            <DataTableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">
              {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
            </DataTableCell>
            <DataTableCell className="font-semibold text-slate-900 tabular-nums">{formatLeaveDays(leave.days)}</DataTableCell>
            <DataTableCell className="max-w-[200px] truncate text-slate-700">{leave.reason}</DataTableCell>
            <DataTableCell>
              <ApprovalBadge workflowStatus={leave.workflowStatus} />
              {leave.rejectionReason && (
                <p className="mt-1 max-w-[180px] text-xs font-medium text-rose-600">{leave.rejectionReason}</p>
              )}
            </DataTableCell>
            <DataTableCell>
              {canAct && (
                <div className="flex flex-wrap gap-1.5">
                  <ApproveButton leaveId={leave.id} version={leave.version} />
                  <RejectionDialog leaveId={leave.id} version={leave.version} />
                </div>
              )}
              {leave.workflowStatus === LeaveWorkflowStatus.approved && (
                <CancelApprovedForm leaveId={leave.id} />
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-900">Timeline</summary>
                <div className="mt-2 max-w-xs">
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
  );
}
