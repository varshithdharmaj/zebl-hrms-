import Link from "next/link";
import { CalendarX2, ArrowRight } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AttendanceHistoryTableRows, HISTORY_TABLE_COLUMNS } from "@/components/employee/attendance-history-table";
import type { ClassifiedAttendanceRecord } from "@/lib/attendance/history-classification";

/** Dashboard preview limit — shows only the most recent 7 records */
const DASHBOARD_PREVIEW_LIMIT = 7;

export function HistorySection({
  rangeLabel,
  records,
}: {
  rangeLabel: string;
  records: ClassifiedAttendanceRecord[];
}) {
  // Dashboard shows only 7 most recent records (data layer already fetches in reverse chronological order)
  const previewRecords = records.slice(0, DASHBOARD_PREVIEW_LIMIT);
  const hasMoreRecords = records.length > DASHBOARD_PREVIEW_LIMIT;

  return (
    <SectionCard
      title="Attendance history"
      description={`${rangeLabel} · Showing ${previewRecords.length} of ${records.length} record${records.length === 1 ? "" : "s"}`}
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
