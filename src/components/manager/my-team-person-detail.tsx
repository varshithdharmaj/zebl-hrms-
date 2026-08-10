import Link from "next/link";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import type { MyTeamPersonDetail } from "@/lib/manager/team-people-query";
import { LEAVE_TYPE_LABELS, type LeaveType } from "@/lib/leave-types";
import { formatDate } from "@/lib/utils";

export function MyTeamPersonSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function MyTeamPersonView({ data }: { data: MyTeamPersonDetail }) {
  const { person, leaveBalances, recentLeaves, attendance } = data;

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        leading={
          <ProfileAvatar alt={`${person.name} profile photo`} editable={false} size="lg" />
        }
        title={person.name}
        description={`${person.employeeCode}${person.designation ? ` · ${person.designation}` : ""}`}
        backHref="/employee/team/people"
        backLabel="People"
        badge={
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            {person.employeeStatus}
          </span>
        }
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/employee/approvals">Approval Center</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Department" value={person.department ?? "—"} />
        <SummaryCard label="Designation" value={person.designation ?? "—"} />
        <SummaryCard label="Shift" value={person.shift ?? "—"} />
        <SummaryCard label="Joined" value={formatDate(person.joiningDate)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Attendance summary" description={attendance.rangeLabel}>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Present days</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{attendance.presentDays}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Attendance %</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {attendance.attendancePercent}%
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Short hours</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {attendance.shortHoursCount}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last attendance</dt>
              <dd className="mt-1 text-sm font-medium">
                {attendance.lastAttendanceDate
                  ? formatDate(attendance.lastAttendanceDate)
                  : "—"}
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Leave balances">
          {leaveBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">No balance data.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {leaveBalances.map((b) => (
                <li key={b.leaveType} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {LEAVE_TYPE_LABELS[b.leaveType as LeaveType] ?? b.leaveType}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {b.remaining} remaining
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent leave">
        {recentLeaves.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent leave requests.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentLeaves.map((leave) => (
              <li
                key={leave.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {LEAVE_TYPE_LABELS[leave.leaveType as LeaveType] ?? leave.leaveType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(leave.startDate)} – {formatDate(leave.endDate)} · {leave.days}{" "}
                    day{leave.days === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {leave.workflowStatus.replaceAll("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-subtle">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
