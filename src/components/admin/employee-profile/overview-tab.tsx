import Link from "next/link";
import { SectionCard } from "@/components/ui/section-card";
import { formatDate } from "@/lib/utils";
import type { ProfileEmployee } from "@/components/admin/employee-profile/profile-shell";

export function OverviewTab({
  employee,
  stats,
}: {
  employee: ProfileEmployee;
  stats: {
    pendingLeaves: number;
    approvedLeavesYtd: number;
    attendancePercent: number;
    lastAttendance: Date | null;
  };
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Reporting structure">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Manager</dt>
            <dd className="font-medium">
              {employee.manager ? (
                <Link
                  href={`/admin/employees/${employee.manager.id}`}
                  className="text-primary hover:underline"
                >
                  {employee.manager.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Direct reports</dt>
            <dd className="font-medium tabular-nums">{employee.directReportsCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Department</dt>
            <dd>{employee.department ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Login</dt>
            <dd>{employee.user?.email ?? "No account"}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Operational summary">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Pending leave</dt>
            <dd className="font-semibold tabular-nums">{stats.pendingLeaves}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Approved (recent)</dt>
            <dd className="tabular-nums">{stats.approvedLeavesYtd}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Attendance (range)</dt>
            <dd className="tabular-nums">{stats.attendancePercent}%</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Last attendance</dt>
            <dd>{stats.lastAttendance ? formatDate(stats.lastAttendance) : "—"}</dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}
