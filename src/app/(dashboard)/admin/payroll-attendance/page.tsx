import Link from "next/link";
import { Suspense } from "react";
import { Download, RefreshCw } from "lucide-react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { PayrollAttendanceFilters } from "@/components/admin/payroll/payroll-attendance-filters";
import { PayrollAttendanceTable } from "@/components/admin/payroll/payroll-attendance-table";
import { PayrollSummaryCards } from "@/components/admin/payroll/payroll-summary-cards";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { getOperationalShiftFilterOption } from "@/lib/attendance-shift";
import { getPayrollSettings } from "@/lib/payroll/payroll-settings";
import {
  listPayrollPeriodOptions,
  parsePayrollPeriodKey,
} from "@/lib/payroll/payroll-period";
import {
  getPayrollAttendanceSummaries,
  getPayrollDashboardCards,
} from "@/lib/payroll/payroll-summaries";

export default async function PayrollAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    q?: string;
    shift?: string;
    shortfall?: string;
    ot?: string;
    late?: string;
    absent?: string;
    pending?: string;
  }>;
}) {
  const params = await searchParams;
  const settings = await getPayrollSettings();
  const period = parsePayrollPeriodKey(params.period, settings.payrollStartDay);
  const periodOptions = listPayrollPeriodOptions(settings.payrollStartDay, 12);
  const shiftFilter = getOperationalShiftFilterOption(params.shift);

  const filters = {
    shift: params.shift,
    hasShortfall: params.shortfall === "1",
    hasOt: params.ot === "1",
    hasLate: params.late === "1",
    hasAbsent: params.absent === "1",
    pendingDecision: params.pending === "1",
    search: params.q,
  };

  const [cards, rows] = await Promise.all([
    getPayrollDashboardCards(period),
    getPayrollAttendanceSummaries(period, filters),
  ]);

  const exportQuery = new URLSearchParams();
  exportQuery.set("period", period.key);
  if (params.q) exportQuery.set("q", params.q);
  if (params.shift) exportQuery.set("shift", params.shift);
  if (params.shortfall === "1") exportQuery.set("shortfall", "1");
  if (params.ot === "1") exportQuery.set("ot", "1");
  if (params.late === "1") exportQuery.set("late", "1");
  if (params.absent === "1") exportQuery.set("absent", "1");
  if (params.pending === "1") exportQuery.set("pending", "1");

  const filterHint = shiftFilter.value ? ` · ${shiftFilter.label}` : "";

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Payroll attendance"
        description={`HR payroll review · ${period.label}${filterHint} · grouped by employee shift`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/api/payroll/export?${exportQuery.toString()}`}>
                <Download className="h-4 w-4" />
                Export Payroll Summary
              </Link>
            </Button>
            <form action="/admin/payroll-attendance" method="get">
              <input type="hidden" name="period" value={period.key} />
              <Button type="submit" variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
                Refresh view
              </Button>
            </form>
          </div>
        }
      />

      <PayrollSummaryCards cards={cards} />

      <SectionCard
        title="Filters"
        description="Payroll period and shift (employee.shift) — no location grouping"
      >
        <Suspense fallback={null}>
          <PayrollAttendanceFilters
            defaultPeriod={period.key}
            defaultSearch={params.q}
            filterOptions={{
              periods: periodOptions.map((p) => ({ key: p.key, label: p.label })),
            }}
            defaults={{
              shift: params.shift,
              shortfall: params.shortfall === "1",
              ot: params.ot === "1",
              late: params.late === "1",
              absent: params.absent === "1",
              pending: params.pending === "1",
            }}
          />
        </Suspense>
      </SectionCard>

      <SectionCard
        title="Payroll summary"
        description={`${rows.length} employee(s) · decisions are manual only — no auto salary or leave deductions`}
        noPadding
      >
        <PayrollAttendanceTable rows={rows} />
      </SectionCard>
    </div>
  );
}
