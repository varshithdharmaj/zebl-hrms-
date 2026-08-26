import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { AttendanceFilters } from "@/components/admin/attendance-filters";
import { AttendanceShiftCell } from "@/components/attendance/attendance-shift-cell";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { getAttendanceRecords } from "@/lib/data";
import {
  getOperationalShiftFilterOption,
  formatTimeAmPm,
  formatWorkedDurationDisplay,
  formatOvertimeDisplay,
} from "@/lib/attendance-shift";
import { getPayrollSettings } from "@/lib/payroll/payroll-settings";
import {
  listPayrollPeriodOptions,
  parsePayrollPeriodKey,
} from "@/lib/payroll/payroll-period";
import { formatDate } from "@/lib/utils";

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    date?: string;
    period?: string;
    shift?: string;
    shortfall?: string;
    ot?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10) || 1;
  const settings = await getPayrollSettings();
  const shiftFilter = getOperationalShiftFilterOption(params.shift);
  const periodOptions = listPayrollPeriodOptions(settings.payrollStartDay, 12);
  const activePeriod = params.period
    ? parsePayrollPeriodKey(params.period, settings.payrollStartDay)
    : null;

  const { records, total, totalPages } = await getAttendanceRecords({
    search: params.q,
    date: params.period ? undefined : params.date,
    period: params.period,
    shift: params.shift,
    shortfall: params.shortfall === "1",
    ot: params.ot === "1",
    page,
  });

  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.period) query.set("period", params.period);
  else if (params.date) query.set("date", params.date);
  if (params.shift) query.set("shift", params.shift);
  if (params.shortfall === "1") query.set("shortfall", "1");
  if (params.ot === "1") query.set("ot", "1");

  function pageHref(nextPage: number) {
    const q = new URLSearchParams(query.toString());
    q.set("page", String(nextPage));
    return `/admin/attendance?${q.toString()}`;
  }

  const hints: string[] = [];
  if (activePeriod) hints.push(activePeriod.label);
  if (shiftFilter.value) hints.push(shiftFilter.label);
  if (params.shortfall === "1") hints.push("Shortfall");
  if (params.ot === "1") hints.push("OT");
  const filterHint = hints.length ? ` · ${hints.join(" · ")}` : "";

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Attendance"
        description={`Daily attendance records · ${total} total${filterHint}`}
        action={
          <div className="w-full rounded-xl border border-border bg-muted/40 p-4 lg:min-w-[24rem]">
            <Suspense fallback={null}>
              <AttendanceFilters
                defaultSearch={params.q}
                defaultDate={params.date}
                defaultPeriod={params.period ?? ""}
                defaultShift={params.shift ?? ""}
                defaultShortfall={params.shortfall === "1"}
                defaultOt={params.ot === "1"}
                periodOptions={periodOptions.map((p) => ({ key: p.key, label: p.label }))}
              />
            </Suspense>
          </div>
        }
      />

      <SectionCard
        title="Records"
        description={`Page ${page} of ${totalPages}${filterHint}`}
        noPadding
      >
        <DataTable
          columns={[
            "Date",
            "Employee",
            "Shift",
            "In Time",
            "Out Time",
            "Work Duration",
            "OT",
            "Remarks",
          ]}
        >
          {records.length === 0 ? (
            <DataTableRow>
              <DataTableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                No records match your filters.
              </DataTableCell>
            </DataTableRow>
          ) : (
            records.map((record) => (
              <DataTableRow key={record.id}>
                <DataTableCell className="whitespace-nowrap align-top">
                  {formatDate(record.attendanceDate)}
                </DataTableCell>
                <DataTableCell className="align-top">
                  <p className="font-medium">{record.employee.name}</p>
                  <p className="text-xs text-muted-foreground">{record.employee.employeeCode}</p>
                </DataTableCell>
                <DataTableCell className="align-top min-w-[9rem]">
                  <AttendanceShiftCell shift={record.employee.shift} compact />
                </DataTableCell>
                <DataTableCell className="tabular-nums align-top whitespace-nowrap">
                  {formatTimeAmPm(record.checkIn)}
                </DataTableCell>
                <DataTableCell className="tabular-nums align-top whitespace-nowrap">
                  {formatTimeAmPm(record.checkOut)}
                </DataTableCell>
                <DataTableCell className="tabular-nums align-top whitespace-nowrap">
                  {formatWorkedDurationDisplay(record.workDuration, record.workedMinutes)}
                </DataTableCell>
                <DataTableCell className="tabular-nums align-top whitespace-nowrap">
                  {formatOvertimeDisplay(record.overtimeMinutes)}
                </DataTableCell>
                <DataTableCell className="align-top max-w-[14rem] text-sm text-muted-foreground">
                  {record.remarks?.trim() ? record.remarks : "—"}
                </DataTableCell>
              </DataTableRow>
            ))
          )}
        </DataTable>

        {totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{page}</span> of{" "}
              <span className="font-medium text-foreground">{totalPages}</span>
            </p>
            <div className="flex gap-2">
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
      </SectionCard>
    </div>
  );
}
