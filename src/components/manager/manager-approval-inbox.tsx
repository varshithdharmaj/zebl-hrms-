"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import {
  bulkApproveLeavesAction,
  type BulkActionState,
} from "@/actions/bulk-workflow";
import { approveLeaveStepAction, type WorkflowActionState } from "@/actions/workflow";
import { RejectionDialog } from "@/components/workflow/rejection-dialog";
import { LeaveWorkflowTimeline } from "@/components/workflow/leave-workflow-timeline";
import { WorkflowProgressBar } from "@/components/workflow/workflow-progress-bar";
import { Sheet } from "@/components/ui/sheet";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { LEAVE_TYPE_LABELS, formatLeaveDays, type LeaveType } from "@/lib/leave-types";
import { formatDate } from "@/lib/utils";
import type { LeaveWorkflowStatus } from "@prisma/client";
import type { LeaveBalanceSummary } from "@/lib/leave";
import type { LeaveOverlapWarning } from "@/lib/leave/leave-overlap";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";

const approveInitial: WorkflowActionState = {};
const bulkInitial: BulkActionState = {};

export type PendingApprovalItem = {
  leave: {
    id: number;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    days: number;
    reason: string;
    workflowStatus: LeaveWorkflowStatus;
    version: number;
    employeeName: string;
    employeeId: number;
    department: string | null;
    submittedAt: Date | null;
    rejectionReason: string | null;
    currentStepId: number | null;
    steps: {
      id: number;
      stepOrder: number;
      approverRole: string;
      approverName: string | null;
      status: string;
      actedAt: Date | null;
      comment: string | null;
    }[];
  };
  balances: LeaveBalanceSummary[];
  recentLeaves: {
    id: number;
    leaveType: string;
    days: number;
    workflowStatus: LeaveWorkflowStatus;
    startDate: Date;
    endDate: Date;
  }[];
  overlapWarnings: LeaveOverlapWarning[];
  sla: {
    label: string;
    overdue: boolean;
    percentElapsed: number;
  };
};

type SortKey = "submitted" | "start" | "days" | "sla";

function ApproveButton({ leaveId, version }: { leaveId: number; version: number }) {
  const [state, formAction, pending] = useActionState(approveLeaveStepAction, approveInitial);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="leaveId" value={leaveId} />
      <input type="hidden" name="version" value={version} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Approve"}
      </Button>
      {state.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function ManagerApprovalInbox({ items }: { items: PendingApprovalItem[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("sla");
  const [sortAsc, setSortAsc] = useState(false);
  const [bulkState, bulkApproveAction, bulkPending] = useActionState(
    bulkApproveLeavesAction,
    bulkInitial
  );

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sort === "submitted") {
        cmp =
          (a.leave.submittedAt?.getTime() ?? 0) - (b.leave.submittedAt?.getTime() ?? 0);
      } else if (sort === "start") {
        cmp = a.leave.startDate.getTime() - b.leave.startDate.getTime();
      } else if (sort === "days") {
        cmp = a.leave.days - b.leave.days;
      } else {
        cmp = a.sla.percentElapsed - b.sla.percentElapsed;
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [items, sort, sortAsc]);

  const preview = sorted.find((i) => i.leave.id === previewId) ?? null;

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortAsc(!sortAsc);
    else {
      setSort(key);
      setSortAsc(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((i) => i.leave.id)));
  };

  const bulkItems = sorted
    .filter((i) => selected.has(i.leave.id))
    .map((i) => ({ leaveId: i.leave.id, version: i.leave.version }));

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!preview) return;
      if (e.key === "a" && !e.metaKey && !e.ctrlKey) {
        const btn = document.getElementById(`approve-${preview.leave.id}`);
        btn?.click();
      }
    },
    [preview]
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  if (items.length === 0) {
    return (
      <SectionCard title="No pending approvals" description="Your approval queue is completely clear.">
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/20">
            ✓
          </div>
          <p className="text-sm font-medium text-slate-900">All caught up!</p>
          <p className="mt-1 text-xs text-slate-500">
            New leave requests submitted by your direct reports will automatically arrive here.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAll}>
            {selected.size === sorted.length ? "Deselect all" : "Select all"}
          </Button>
          <form action={bulkApproveAction} className="inline">
            <input type="hidden" name="items" value={JSON.stringify(bulkItems)} />
            <Button type="submit" size="sm" disabled={bulkPending || selected.size === 0}>
              {bulkPending ? "Approving…" : `Approve selected (${selected.size})`}
            </Button>
          </form>
          {bulkState.success && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">{bulkState.success}</span>
          )}
          {bulkState.error && <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded-md">{bulkState.error}</span>}
        </div>
        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
          Click row to preview · Press <kbd className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-[10px]">A</kbd> to approve active
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-subtle">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50/80 text-left text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500 border-b border-border">
            <tr>
              <th className="px-4 py-3 w-8" />
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">
                <button type="button" className="inline-flex items-center gap-1 font-bold" onClick={() => toggleSort("start")}>
                  Dates {sort === "start" && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="font-bold" onClick={() => toggleSort("days")}>Days</button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="font-bold" onClick={() => toggleSort("sla")}>SLA</button>
              </th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((item) => (
              <tr
                key={item.leave.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-slate-50/70",
                  previewId === item.leave.id && "bg-slate-100/80"
                )}
                onClick={() => setPreviewId(item.leave.id)}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(item.leave.id)}
                    onChange={() => toggleSelect(item.leave.id)}
                    aria-label={`Select ${item.leave.employeeName}`}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{item.leave.employeeName}</p>
                  <p className="text-xs text-slate-500 font-medium">{item.leave.leaveType}</p>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                  {formatDate(item.leave.startDate)} – {formatDate(item.leave.endDate)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900 tabular-nums">{formatLeaveDays(item.leave.days)}</td>
                <td className="px-4 py-3 w-28">
                  <WorkflowProgressBar
                    percent={item.sla.percentElapsed}
                    overdue={item.sla.overdue}
                    label={item.sla.label}
                  />
                </td>
                <td className="px-4 py-3">
                  {item.overlapWarnings.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-600/20" title={item.overlapWarnings[0]?.message}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {item.overlapWarnings.length} overlap
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
                    <span id={`approve-${item.leave.id}`}>
                      <ApproveButton leaveId={item.leave.id} version={item.leave.version} />
                    </span>
                    <RejectionDialog leaveId={item.leave.id} version={item.leave.version} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet
        open={!!preview}
        onClose={() => setPreviewId(null)}
        title={preview ? `${preview.leave.employeeName} — ${preview.leave.leaveType}` : ""}
        description={
          preview
            ? `${formatDate(preview.leave.startDate)} – ${formatDate(preview.leave.endDate)}`
            : undefined
        }
      >
        {preview && (
          <div className="space-y-6">
            <p className="text-sm">{preview.leave.reason}</p>
            {preview.overlapWarnings.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning-muted p-3 text-sm">
                {preview.overlapWarnings.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                    {w.message}
                  </li>
                ))}
              </ul>
            )}
            <WorkflowProgressBar
              percent={preview.sla.percentElapsed}
              overdue={preview.sla.overdue}
              label={preview.sla.label}
            />
            <div className="flex gap-2">
              <ApproveButton leaveId={preview.leave.id} version={preview.leave.version} />
              <RejectionDialog leaveId={preview.leave.id} version={preview.leave.version} />
            </div>
            <LeaveWorkflowTimeline
              workflowStatus={preview.leave.workflowStatus}
              submittedAt={preview.leave.submittedAt}
              rejectionReason={preview.leave.rejectionReason}
              steps={preview.leave.steps}
              currentStepId={preview.leave.currentStepId}
            />
            <div>
              <h4 className="text-sm font-semibold">Balances</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {preview.balances.map((b) => (
                  <li key={b.leaveType}>
                    {LEAVE_TYPE_LABELS[b.leaveType as LeaveType]}: {formatLeaveDays(b.remaining)} left
                  </li>
                ))}
              </ul>
            </div>
            <DataTable columns={["Type", "Period", "Days", "Status"]} emptyMessage="No history.">
              {preview.recentLeaves.map((r) => (
                <DataTableRow key={r.id}>
                  <DataTableCell>{r.leaveType}</DataTableCell>
                  <DataTableCell className="text-xs">
                    {formatDate(r.startDate)} – {formatDate(r.endDate)}
                  </DataTableCell>
                  <DataTableCell>{formatLeaveDays(r.days)}</DataTableCell>
                  <DataTableCell className="text-xs capitalize">
                    {r.workflowStatus.replace(/_/g, " ")}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTable>
          </div>
        )}
      </Sheet>
    </div>
  );
}
