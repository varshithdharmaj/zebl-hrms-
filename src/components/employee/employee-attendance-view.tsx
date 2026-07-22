import { Suspense } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  AlertCircle,
  Timer,
  Percent,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatsGrid } from "@/components/ui/stats-grid";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { ChartCard } from "@/components/ui/chart-card";
import { AttendanceHistoryTableRows, HISTORY_TABLE_COLUMNS } from "@/components/employee/attendance-history-table";
import {
  getEmployeeAttendanceHistory,
  getEmployeeAttendanceSummary,
} from "@/lib/queries";
import { formatDate, minutesToHours } from "@/lib/utils";

export async function EmployeeAttendanceView({
  employeeId,
  startDate,
  endDate,
  page,
}: {
  employeeId: number;
  startDate?: string;
  endDate?: string;
  page: number;
}) {
  const [summary, history] = await Promise.all([
    getEmployeeAttendanceSummary(employeeId, startDate, endDate),
    getEmployeeAttendanceHistory(employeeId, page, startDate, endDate),
  ]);

  const rangeLabel = summary.rangeLabel;
  const { records, total, totalPages } = history;

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("start", summary.selectedStart);
    params.set("end", summary.selectedEnd);
    return `/employee/attendance?${params.toString()}`;
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Attendance history"
        description="Browse and filter your complete attendance record."
        backHref="/employee/dashboard"
        backLabel="Dashboard"
        action={
          <div className="w-full rounded-xl border border-border bg-muted/40 p-4 lg:min-w-[20rem]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Date range
            </p>
            <Suspense fallback={<div className="h-20 animate-pulse rounded-lg bg-muted" />}>
              <DateRangeFilter
                defaultStart={summary.selectedStart}
                defaultEnd={summary.selectedEnd}
                layout="compact"
              />
            </Suspense>
          </div>
        }
      />

      <StatsGrid>
        <DashboardCard
          label="Present days"
          value={summary.presentDays}
          hint={rangeLabel}
          icon={CalendarCheck}
          accent="green"
        />
        <DashboardCard
          label="Short hours"
          value={summary.shortHoursCount}
          hint="In range"
          icon={AlertCircle}
          accent="amber"
        />
        <DashboardCard
          label="Overtime"
          value={minutesToHours(summary.overtimeMinutes)}
          hint="In range"
          icon={Timer}
          accent="violet"
        />
        <DashboardCard
          label="Attendance rate"
          value={`${summary.attendancePercent}%`}
          hint={`${total} record${total === 1 ? "" : "s"} total`}
          icon={Percent}
          accent="blue"
        />
      </StatsGrid>

      <ChartCard title="Attendance trend" description={rangeLabel} records={summary.records} />

      <SectionCard
        title="All records"
        description={`${rangeLabel} · Page ${page} of ${totalPages}`}
        noPadding
      >
        {records.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={CalendarX2}
              title="No attendance records"
              description="Try widening your date range or check back after records are uploaded."
            />
          </div>
        ) : (
          <>
            <DataTable columns={HISTORY_TABLE_COLUMNS}>
              <AttendanceHistoryTableRows records={records} />
            </DataTable>

            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-4 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  Showing page <span className="font-medium text-foreground">{page}</span> of{" "}
                  <span className="font-medium text-foreground">{totalPages}</span>
                  <span className="mx-2 text-border">·</span>
                  <span className="font-medium text-foreground">{total}</span> records
                </p>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={pageHref(page - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                  )}
                  {page < totalPages ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={pageHref(page + 1)}>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {summary.lastAttendanceDate && (
        <p className="text-center text-sm text-muted-foreground">
          Last recorded attendance:{" "}
          <span className="font-medium text-foreground">
            {formatDate(summary.lastAttendanceDate)}
          </span>
        </p>
      )}
    </div>
  );
}
