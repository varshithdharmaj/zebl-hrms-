import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ClipboardList,
  Plug,
  Users,
} from "lucide-react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { getHrCommandCenterData } from "@/lib/hr/command-center";
import { formatDate } from "@/lib/utils";
import { ErrorAlert } from "@/components/ui/error-alert";

function ActionCard({
  title,
  value,
  hint,
  href,
  urgent,
}: {
  title: string;
  value: number | string;
  hint: string;
  href: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl border p-4 transition-shadow hover:shadow-subtle ${
        urgent ? "border-danger/40 bg-danger-muted/30" : "border-border bg-card"
      }`}
    >
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}

export async function HrCommandCenterView() {
  let data: Awaited<ReturnType<typeof getHrCommandCenterData>>;
  try {
    data = await getHrCommandCenterData();
  } catch (error) {
    console.error("[HrCommandCenter] failed to load dashboard data", error);
    return (
      <div className="space-y-4">
        <WorkspacePageHeader
          title="HR command center"
          description="Action-oriented view — pending work, risks, and staffing gaps."
        />
        <ErrorAlert message="Dashboard data could not be loaded. Check DATABASE_URL on Vercel (use Neon pooled URL with ?sslmode=require) and try again." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="HR command center"
        description="Action-oriented view — pending work, risks, and staffing gaps."
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href="/admin/leaves">Leave queue</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/operations">Operations</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          title="Pending HR approvals"
          value={data.pendingApprovals}
          hint="Requires action"
          href="/admin/leaves"
          urgent={data.pendingApprovals > 0}
        />
        <ActionCard
          title="Escalation risk"
          value={data.escalationRisk}
          hint="Past SLA threshold"
          href="/admin/leaves"
          urgent={data.escalationRisk > 0}
        />
        <ActionCard
          title="Absent today"
          value={data.absentToday}
          hint="Attendance records"
          href="/admin/attendance"
        />
        <ActionCard
          title="Failed notifications"
          value={data.failedNotifications}
          hint={`${data.notificationPending} queued`}
          href="/admin/notifications"
          urgent={data.failedNotifications > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="On leave today" description={`${data.onLeaveToday.length} shown`}>
          {data.onLeaveToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved leave today.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {data.onLeaveToday.map((l) => (
                <li key={l.id} className="flex justify-between py-2">
                  <span className="font-medium">{l.name}</span>
                  <span className="text-muted-foreground">
                    {l.leaveType}
                    {l.department ? ` · ${l.department}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/calendar" className="mt-3 inline-block text-sm text-primary hover:underline">
            Open leave calendar →
          </Link>
        </SectionCard>

        <SectionCard title="Leave conflicts" description="Overlapping team coverage">
          {data.leaveConflicts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conflicts in pending queue.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.leaveConflicts.map((c) => (
                <li key={c.leaveId} className="flex gap-2 rounded-lg bg-warning-muted/50 p-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  <span>
                    <strong>{c.employeeName}</strong>: {c.warnings[0]?.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Escalation backlog" description="Submitted past escalation window">
          {data.escalationItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overdue items.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {data.escalationItems.map((e) => (
                <li key={e.id} className="py-2">
                  <span className="font-medium">{e.employeeName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {e.leaveType} · {e.submittedAt ? formatDate(new Date(e.submittedAt)) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Short-staffed departments" description="Multiple absences today">
          {data.departmentsShortStaffed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No department alerts.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.departmentsShortStaffed.map((d) => (
                <li key={d.department} className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <span>{d.department}</span>
                  <span className="font-semibold text-danger">{d.absentCount} absent</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {(data.workflowStuckCount > 0 || data.graphHealth === "error") && (
        <SectionCard title="System alerts" description="Requires attention">
          <ul className="space-y-2 text-sm">
            {data.workflowStuckCount > 0 && (
              <li className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-warning" />
                {data.workflowStuckCount} stuck workflow(s) —{" "}
                <Link href="/admin/operations" className="text-primary hover:underline">
                  view operations
                </Link>
              </li>
            )}
            {data.graphHealth === "error" && (
              <li className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-danger" />
                Microsoft Graph unhealthy —{" "}
                <Link href="/admin/integrations" className="text-primary hover:underline">
                  integrations
                </Link>
              </li>
            )}
          </ul>
        </SectionCard>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/employees" className="inline-flex items-center gap-1 text-primary hover:underline">
          <Users className="h-4 w-4" /> Employees
        </Link>
        <Link href="/admin/audit" className="inline-flex items-center gap-1 text-primary hover:underline">
          <Bell className="h-4 w-4" /> Audit log
        </Link>
        <Link href="/admin/calendar" className="inline-flex items-center gap-1 text-primary hover:underline">
          <CalendarDays className="h-4 w-4" /> Calendar
        </Link>
        <Link href="/admin/settings" className="inline-flex items-center gap-1 text-primary hover:underline">
          Settings
        </Link>
      </div>
    </div>
  );
}
