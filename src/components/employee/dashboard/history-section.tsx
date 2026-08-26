import { Suspense } from "react";
import Link from "next/link";
import { CalendarX2, ArrowRight } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { DashboardToolbar } from "@/components/employee/dashboard-toolbar";
import { formatDate, minutesToHours } from "@/lib/utils";

type Record = {
  id: number;
  attendanceDate: Date;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  status: string;
};

export function HistorySection({
  rangeLabel,
  records,
  defaultDate,
  defaultStart,
  defaultEnd,
}: {
  rangeLabel: string;
  records: Record[];
  defaultDate: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  return (
    <SectionCard
      title="Attendance history"
      description={`${rangeLabel} · ${records.length} record${records.length === 1 ? "" : "s"}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <DashboardToolbar
              defaultDate={defaultDate}
              defaultStart={defaultStart}
              defaultEnd={defaultEnd}
              layout="inline"
              showDayPicker={false}
            />
          </Suspense>
          <Button variant="outline" size="sm" asChild>
            <Link href="/employee/attendance">
              Full history
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      }
      noPadding
    >
      {records.length === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={CalendarX2}
            title="No records in this range"
            description="Try a different date range or check back after attendance is uploaded."
          />
        </div>
      ) : (
        <DataTable columns={["Date", "Check in", "Check out", "Worked", "Overtime", "Status"]}>
          {records.map((r) => (
            <DataTableRow key={r.id}>
              <DataTableCell className="font-medium whitespace-nowrap">
                {formatDate(r.attendanceDate)}
              </DataTableCell>
              <DataTableCell className="tabular-nums">{r.checkIn ?? "—"}</DataTableCell>
              <DataTableCell className="tabular-nums">{r.checkOut ?? "—"}</DataTableCell>
              <DataTableCell className="tabular-nums">
                {minutesToHours(r.workedMinutes)}
              </DataTableCell>
              <DataTableCell className="tabular-nums">
                {minutesToHours(r.overtimeMinutes)}
              </DataTableCell>
              <DataTableCell>
                <StatusBadge status={r.status} />
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </SectionCard>
  );
}
