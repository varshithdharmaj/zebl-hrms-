import Link from "next/link";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { LEAVE_TYPE_LABELS, formatLeaveDays, type LeaveType } from "@/lib/leave-types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type {
  MyTeamLeaveOverviewDto,
  MyTeamLeaveRequestSummary,
} from "@/lib/manager/team-leave-query";

export function MyTeamLeaveSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function statusClass(status: string) {
  if (status === "approved") return "bg-success-muted text-success";
  if (status === "rejected") return "bg-destructive/10 text-destructive";
  if (status === "pending_approval") return "bg-warning-muted text-warning";
  return "bg-muted text-muted-foreground";
}

function LeaveRequestTable({
  rows,
  emptyTitle,
  emptyHint,
}: {
  rows: MyTeamLeaveRequestSummary[];
  emptyTitle: string;
  emptyHint: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <DataTable columns={["Employee", "Type", "Period", "Days", "Status"]}>
      {rows.map((r) => (
        <DataTableRow key={r.id}>
          <DataTableCell>
            <div className="font-medium text-foreground">{r.employeeName}</div>
            <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
          </DataTableCell>
          <DataTableCell>
            {LEAVE_TYPE_LABELS[r.leaveType as LeaveType] ?? r.leaveType}
          </DataTableCell>
          <DataTableCell className="whitespace-nowrap text-xs">
            {formatDate(r.startDate)} – {formatDate(r.endDate)}
          </DataTableCell>
          <DataTableCell className="tabular-nums">{formatLeaveDays(r.days)}</DataTableCell>
          <DataTableCell>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs capitalize",
                statusClass(r.workflowStatus)
              )}
            >
              {r.workflowStatus.replace(/_/g, " ")}
            </span>
          </DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  );
}

export function MyTeamLeaveView({ data }: { data: MyTeamLeaveOverviewDto }) {
  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Team Leave"
        description="Read-only leave balances and requests for your direct reports."
        badge={
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            {data.directReportCount} report{data.directReportCount === 1 ? "" : "s"}
          </span>
        }
        action={
          <Link
            href="/employee/approvals"
            className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Approval Center
          </Link>
        }
      />

      {data.directReportCount === 0 ? (
        <SectionCard>
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-foreground">No active team members</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Direct reports assigned to you will appear here.
            </p>
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Currently on leave" noPadding>
            <LeaveRequestTable
              rows={data.currentlyOnLeave}
              emptyTitle="Nobody on leave today"
              emptyHint="Approved leave covering today will show here."
            />
          </SectionCard>

          <SectionCard title="Leave balances" noPadding>
            {data.balances.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No balances to show</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.balances.map(({ employee, balances }) => (
                  <div key={employee.id} className="px-6 py-4">
                    <div className="mb-2 flex flex-wrap items-baseline gap-2">
                      <Link
                        href={`/employee/team/people/${employee.id}`}
                        className="text-sm font-medium text-foreground hover:underline"
                      >
                        {employee.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">{employee.employeeCode}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {balances.map((b) => (
                        <span
                          key={b.leaveType}
                          className="rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs"
                        >
                          {LEAVE_TYPE_LABELS[b.leaveType as LeaveType] ?? b.leaveType}:{" "}
                          <span className="font-semibold tabular-nums">
                            {formatLeaveDays(b.remaining)}
                          </span>{" "}
                          left
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Pending requests" noPadding>
            <LeaveRequestTable
              rows={data.pending}
              emptyTitle="No pending requests"
              emptyHint="Requests awaiting approval will appear here."
            />
          </SectionCard>

          <SectionCard title="Approved (recent)" noPadding>
            <LeaveRequestTable
              rows={data.approved}
              emptyTitle="No approved requests in recent history"
              emptyHint="Recently approved leave will appear here."
            />
          </SectionCard>

          <SectionCard title="Rejected (recent)" noPadding>
            <LeaveRequestTable
              rows={data.rejected}
              emptyTitle="No rejected requests in recent history"
              emptyHint="Recently rejected leave will appear here."
            />
          </SectionCard>

          <SectionCard title="Recent leave history" noPadding>
            <LeaveRequestTable
              rows={data.recent}
              emptyTitle="No leave history yet"
              emptyHint="Team leave requests will appear here as they are created."
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}
