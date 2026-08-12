import Link from "next/link";
import { CalendarX2, ArrowRight } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AttendanceHistoryTableRows, HISTORY_TABLE_COLUMNS } from "@/components/employee/attendance-history-table";
import type { ClassifiedAttendanceRecord } from "@/lib/attendance/history-classification";
import { DASHBOARD_HISTORY_PREVIEW_LIMIT } from "@/lib/data/constants";

export function HistorySection({
  rangeLabel,
  records,
  totalCount,
}: {
  rangeLabel: string;
  records: ClassifiedAttendanceRecord[];
  /** Classified rows in the selected range (may exceed `records.length` when preview-capped). */
  totalCount?: number;
}) {
  const previewRecords = records.slice(0, DASHBOARD_HISTORY_PREVIEW_LIMIT);
  const resolvedTotal = totalCount ?? records.length;
  const hasMoreRecords = resolvedTotal > DASHBOARD_HISTORY_PREVIEW_LIMIT;

  return (
    <SectionCard
      title="Attendance history"
      description={`${rangeLabel} · Showing ${previewRecords.length} of ${resolvedTotal} record${resolvedTotal === 1 ? "" : "s"}`}
      noPadding
    >
      {resolvedTotal === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={CalendarX2}
            title="No records in this range"
            description="Try a different date range or check back after attendance is uploaded."
          />
        </div>
      ) : (
        <>
          <DataTable columns={HISTORY_TABLE_COLUMNS}>
            <AttendanceHistoryTableRows records={previewRecords} />
          </DataTable>

          {hasMoreRecords && (
            <div className="border-t border-border bg-muted/30 px-6 py-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/employee/attendance">
                  View all attendance
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
