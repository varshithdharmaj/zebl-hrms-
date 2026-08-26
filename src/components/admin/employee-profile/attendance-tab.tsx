import { Suspense } from "react";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, minutesToHours } from "@/lib/utils";
import { CalendarCheck, AlertCircle, Timer, Percent } from "lucide-react";

type AttendanceSummary = {
  rangeLabel: string;
  selectedStart: string;
  selectedEnd: string;
  presentDays: number;
  shortHoursCount: number;
  overtimeMinutes: number;
  attendancePercent: number;
  lastAttendanceDate: Date | null;
  records: {
    id: number;
    attendanceDate: Date;
    checkIn: string | null;
    checkOut: string | null;
    workedMinutes: number;
    overtimeMinutes: number;
    status: string;
  }[];
};

export function AttendanceTab({
  summary,
  defaultStart,
  defaultEnd,
}: {
  summary: AttendanceSummary;
  defaultStart: string;
  defaultEnd: string;
}) {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <DateRangeFilter defaultStart={defaultStart} defaultEnd={defaultEnd} />
      </Suspense>

      <p className="text-sm text-muted-foreground">
        Showing records for <span className="font-medium text-foreground">{summary.rangeLabel}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard label="Present days" value={summary.presentDays} icon={CalendarCheck} />
        <DashboardCard label="Short hours" value={summary.shortHoursCount} icon={AlertCircle} />
        <DashboardCard label="Overtime" value={minutesToHours(summary.overtimeMinutes)} icon={Timer} />
        <DashboardCard label="Attendance rate" value={`${summary.attendancePercent}%`} icon={Percent} />
      </div>

      <p className="text-sm text-muted-foreground">
        Last attendance:{" "}
        {summary.lastAttendanceDate ? formatDate(summary.lastAttendanceDate) : "—"}
      </p>

      <DataTable columns={["Date", "In", "Out", "Worked", "OT", "Status"]} emptyMessage="No records in this date range.">
        {summary.records.map((r) => (
          <DataTableRow key={r.id}>
            <DataTableCell className="font-medium">{formatDate(r.attendanceDate)}</DataTableCell>
            <DataTableCell className="tabular-nums">{r.checkIn ?? "—"}</DataTableCell>
            <DataTableCell className="tabular-nums">{r.checkOut ?? "—"}</DataTableCell>
            <DataTableCell>{minutesToHours(r.workedMinutes)}</DataTableCell>
            <DataTableCell>{minutesToHours(r.overtimeMinutes)}</DataTableCell>
            <DataTableCell>
              <StatusBadge status={r.status} />
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  );
}
