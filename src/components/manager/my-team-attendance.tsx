import Link from "next/link";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ListMyTeamAttendanceParams,
  MyTeamAttendanceListResult,
} from "@/lib/manager/team-attendance-query";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function MyTeamAttendanceSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

function buildHref(
  base: ListMyTeamAttendanceParams & { page?: number },
  overrides: Partial<ListMyTeamAttendanceParams & { page?: number }> = {}
) {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  if (merged.search?.trim()) params.set("q", merged.search.trim());
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  if (merged.status) params.set("status", merged.status);
  if (merged.lateOnly) params.set("late", "1");
  if (merged.earlyExitOnly) params.set("early", "1");
  if (merged.overtimeOnly) params.set("ot", "1");
  if (merged.shortfallOnly) params.set("shortfall", "1");
  if (merged.sort && merged.sort !== "date") params.set("sort", merged.sort);
  if (merged.sortDir && merged.sortDir !== "desc") params.set("dir", merged.sortDir);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  const qs = params.toString();
  return qs ? `/employee/team/attendance?${qs}` : "/employee/team/attendance";
}

export function MyTeamAttendanceView({
  data,
  filters,
}: {
  data: MyTeamAttendanceListResult;
  filters: ListMyTeamAttendanceParams;
}) {
  const totalPages = Math.max(1, data.totalPages || 1);

  function sortHref(sort: NonNullable<ListMyTeamAttendanceParams["sort"]>) {
    const nextDir =
      filters.sort === sort && filters.sortDir !== "asc" ? "asc" : "desc";
    return buildHref(filters, { sort, sortDir: nextDir, page: 1 });
  }

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Team Attendance"
        description="Read-only attendance for your direct reports."
        badge={
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            {data.total} record{data.total === 1 ? "" : "s"}
          </span>
        }
      />

      <SectionCard title="Filters">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Search</span>
            <input
              name="q"
              defaultValue={filters.search ?? ""}
              placeholder="Name or code"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">From</span>
            <input
              type="date"
              name="from"
              defaultValue={filters.from ?? ""}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">To</span>
            <input
              type="date"
              name="to"
              defaultValue={filters.to ?? ""}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Status</span>
            <input
              name="status"
              defaultValue={filters.status ?? ""}
              placeholder="e.g. Present"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>
          <fieldset className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="late" value="1" defaultChecked={filters.lateOnly} />
              Late only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="early"
                value="1"
                defaultChecked={filters.earlyExitOnly}
              />
              Early exit only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="ot"
                value="1"
                defaultChecked={filters.overtimeOnly}
              />
              Overtime only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="shortfall"
                value="1"
                defaultChecked={filters.shortfallOnly}
              />
              Shortfall only
            </label>
          </fieldset>
          <div className="flex items-end gap-2">
            <Button type="submit">Apply</Button>
            <Button asChild type="button" variant="outline">
              <Link href="/employee/team/attendance">Reset</Link>
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Records"
        description={`Page ${data.page} of ${totalPages}`}
        noPadding
      >
        {data.total === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No attendance records found.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/80">
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Link href={sortHref("name")} className="hover:text-foreground">
                        Employee
                      </Link>
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      Code
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      Dept
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      Designation
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Link href={sortHref("date")} className="hover:text-foreground">
                        Date
                      </Link>
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      In
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      Out
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Link href={sortHref("workedHours")} className="hover:text-foreground">
                        Worked
                      </Link>
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      Late
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      Early
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      OT
                    </th>
                    <th className="px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      Shortfall
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {data.items.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        <Link
                          href={`/employee/team/people/${row.employeeId}`}
                          className="hover:underline"
                        >
                          {row.employeeName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{row.employeeCode}</td>
                      <td className="px-3 py-2.5">{row.department ?? "—"}</td>
                      <td className="px-3 py-2.5">{row.designation ?? "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {formatDate(row.attendanceDate)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                        {row.checkInDisplay}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                        {row.checkOutDisplay}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                        {row.workedHoursDisplay}
                      </td>
                      <td className="px-3 py-2.5">{row.status}</td>
                      <td className="px-3 py-2.5">
                        <Flag yes={row.isLate} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Flag yes={row.isEarlyExit} />
                      </td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                        {row.overtimeDisplay}
                      </td>
                      <td className="px-3 py-2.5">
                        <Flag yes={row.hasShortfall} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <p className="text-muted-foreground">
                  Page {data.page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={buildHref(filters, { page: Math.max(1, data.page - 1) })}
                      className={cn(data.page <= 1 && "pointer-events-none opacity-50")}
                    >
                      Previous
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={buildHref(filters, {
                        page: Math.min(totalPages, data.page + 1),
                      })}
                      className={cn(data.page >= totalPages && "pointer-events-none opacity-50")}
                    >
                      Next
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}

function Flag({ yes }: { yes: boolean }) {
  return (
    <span className={cn("text-xs font-medium", yes ? "text-foreground" : "text-muted-foreground")}>
      {yes ? "Yes" : "—"}
    </span>
  );
}
