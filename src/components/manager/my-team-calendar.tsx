import Link from "next/link";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { LEAVE_TYPE_LABELS, type LeaveType } from "@/lib/leave-types";
import { formatDate, toISODate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type {
  GetMyTeamCalendarParams,
  MyTeamCalendarDto,
} from "@/lib/manager/team-calendar-query";

export function MyTeamCalendarSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

function buildHref(params: GetMyTeamCalendarParams) {
  const qs = new URLSearchParams();
  if (params.view && params.view !== "month") qs.set("view", params.view);
  if (params.date) qs.set("date", params.date);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const s = qs.toString();
  return s ? `/employee/team/calendar?${s}` : "/employee/team/calendar";
}

function shiftMonth(isoDate: string, delta: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setMonth(d.getMonth() + delta);
  return toISODate(d);
}

function shiftWeek(isoDate: string, deltaWeeks: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return toISODate(d);
}

export function MyTeamCalendarView({
  data,
  filters,
}: {
  data: MyTeamCalendarDto;
  filters: GetMyTeamCalendarParams;
}) {
  const anchor = filters.date ?? toISODate(data.rangeStart);
  const view = data.view;

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Team Calendar"
        description="Read-only leave calendar for your direct reports."
        badge={
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            {data.directReportCount} report{data.directReportCount === 1 ? "" : "s"}
          </span>
        }
      />

      <SectionCard title="Period">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildHref({ view: "month", date: anchor })}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              view === "month" ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            Month
          </Link>
          <Link
            href={buildHref({ view: "week", date: anchor })}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              view === "week" ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            Week
          </Link>
          <Link
            href={buildHref({
              view: "range",
              from: filters.from ?? toISODate(data.rangeStart),
              to: filters.to ?? toISODate(data.rangeEnd),
            })}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              view === "range" ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            Range
          </Link>
        </div>

        {view === "range" ? (
          <form method="get" className="mt-4 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="view" value="range" />
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">From</span>
              <input
                type="date"
                name="from"
                defaultValue={filters.from ?? toISODate(data.rangeStart)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">To</span>
              <input
                type="date"
                name="to"
                defaultValue={filters.to ?? toISODate(data.rangeEnd)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
              >
                Apply
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{data.rangeLabel}</span>
            <Link
              href={buildHref({
                view,
                date:
                  view === "week" ? shiftWeek(anchor, -1) : shiftMonth(anchor, -1),
              })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Previous
            </Link>
            <Link
              href={buildHref({ view, date: toISODate(new Date()) })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Today
            </Link>
            <Link
              href={buildHref({
                view,
                date:
                  view === "week" ? shiftWeek(anchor, 1) : shiftMonth(anchor, 1),
              })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Next →
            </Link>
          </div>
        )}
      </SectionCard>

      {data.holidays.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.holidays.map((h) => (
            <span
              key={h.id}
              className="rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs"
            >
              {h.name} · {formatDate(h.holidayDate)}
            </span>
          ))}
        </div>
      )}

      <SectionCard title="Leave in period" noPadding>
        {data.directReportCount === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No active team members</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Direct reports assigned to you will appear here.
            </p>
          </div>
        ) : data.events.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No leave in this period</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Approved and pending leave overlapping this range will show here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">Department</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.events.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{e.employeeName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{e.department ?? "—"}</td>
                    <td className="px-4 py-2">
                      {LEAVE_TYPE_LABELS[e.leaveType as LeaveType] ?? e.leaveType}
                    </td>
                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                      {formatDate(e.startDate)} – {formatDate(e.endDate)}
                    </td>
                    <td className="px-4 py-2 capitalize text-xs">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5",
                          e.workflowStatus === "approved"
                            ? "bg-success-muted text-success"
                            : "bg-warning-muted text-warning"
                        )}
                      >
                        {e.workflowStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
