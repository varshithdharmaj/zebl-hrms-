import Link from "next/link";
import { AlertTriangle, CalendarDays, ClipboardList, UserCheck, Users } from "lucide-react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MyTeamOverviewDto } from "@/lib/manager/dashboard-types";
import { cn } from "@/lib/utils";

function WidgetError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
      {message}
    </p>
  );
}

export function MyTeamOverviewSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}

export function MyTeamOverviewView({ data }: { data: MyTeamOverviewDto }) {
  const { attention, absentToday, presence, directReportCount, quickActions } = data;

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="My Team"
        description="What needs your attention for your people today."
        badge={
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            Direct reports: {directReportCount}
          </span>
        }
      />

      <SectionCard
        title="Attention"
        description="Pending leave approvals assigned to you."
        action={
          <Button asChild size="sm">
            <Link href="/employee/approvals">Open Approvals</Link>
          </Button>
        }
      >
        {attention.error ? (
          <WidgetError message="Couldn’t load pending approvals. Try again later." />
        ) : attention.pendingCount === 0 ? (
          <p className="text-sm text-muted-foreground">You’re all caught up.</p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {attention.pendingCount}
              <span className="ml-2 text-sm font-medium text-muted-foreground">pending</span>
            </p>
            {attention.overdueCount > 0 && (
              <p className="text-sm font-medium text-destructive">
                {attention.overdueCount} overdue
              </p>
            )}
            {attention.slaLabel && (
              <p className="text-sm text-muted-foreground">SLA: {attention.slaLabel}</p>
            )}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Absent today" description="Approved leave covering today.">
          {absentToday.error ? (
            <WidgetError message="Couldn’t load who’s away today." />
          ) : absentToday.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one away today.</p>
          ) : (
            <ul className="space-y-2">
              {absentToday.items.map((person) => (
                <li
                  key={person.employeeId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-foreground">{person.name}</span>
                  <span className="text-muted-foreground">{person.leaveType}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Presence pulse" description="Team status for today.">
          {presence.error ? (
            <WidgetError message="Couldn’t load presence." />
          ) : directReportCount === 0 ? (
            <p className="text-sm text-muted-foreground">No active team members yet.</p>
          ) : (
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/60 px-2 py-3">
                <dt className="text-xs font-medium text-muted-foreground">Present</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {presence.present}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/60 px-2 py-3">
                <dt className="text-xs font-medium text-muted-foreground">On leave</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {presence.onLeave}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/60 px-2 py-3">
                <dt className="text-xs font-medium text-muted-foreground">Unknown</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {presence.unknown}
                </dd>
              </div>
            </dl>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Quick actions" noPadding>
        <div className="flex flex-wrap gap-2 p-4 sm:p-6">
          {quickActions.map((action) => (
            <Button key={action.href} asChild variant="outline" size="sm">
              <Link href={action.href} className="gap-2">
                <QuickActionIcon href={action.href} />
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function QuickActionIcon({ href }: { href: string }) {
  const className = cn("h-3.5 w-3.5 shrink-0 text-muted-foreground");
  if (href.includes("/approvals")) return <UserCheck className={className} aria-hidden />;
  if (href.includes("/people")) return <Users className={className} aria-hidden />;
  if (href.includes("/attendance")) return <ClipboardList className={className} aria-hidden />;
  return <CalendarDays className={className} aria-hidden />;
}
