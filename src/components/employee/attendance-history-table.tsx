import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { CATEGORY_LABEL } from "@/lib/attendance/day-labels";
import { cn, formatDate, minutesToHours } from "@/lib/utils";
import type { AttendanceDayCategory } from "@/lib/attendance/day-classification";
import type { ClassifiedAttendanceRecord } from "@/lib/attendance/history-classification";

// Mirrors the Heatmap's own category colors (attendance-heatmap.tsx) so the same
// attendance state never reads differently between the two surfaces.
const PRESENT_CLASS =
  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/20";

export const CATEGORY_BADGE_CLASS: Record<AttendanceDayCategory, string> = {
  PRESENT: PRESENT_CLASS,
  WORKED_ON_HOLIDAY: PRESENT_CLASS,
  WORKED_ON_WEEKLY_OFF: PRESENT_CLASS,
  ABSENT: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-400/20",
  LEAVE:
    "bg-violet-50 text-violet-700 ring-1 ring-violet-600/20 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-400/20",
  HOLIDAY: "bg-slate-200 text-slate-700 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600",
  WEEKLY_OFF: "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:ring-slate-700",
  INSUFFICIENT_DATA:
    "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/20",
};

function CategoryBadge({ category }: { category: AttendanceDayCategory }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tracking-tight",
        CATEGORY_BADGE_CLASS[category]
      )}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}

function InlineTag({ label }: { label: string }) {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

/** True only once the day is over — a low ratio mid-day just means it isn't finished
 *  yet, mirroring the same guard hero-status.ts uses for the Hero's shortHours badge. */
export function isShortHoursDay(record: ClassifiedAttendanceRecord): boolean {
  return (
    Boolean(record.checkOut) &&
    (record.ratioTier === "very_low" || record.ratioTier === "partial")
  );
}

export const HISTORY_TABLE_COLUMNS = ["Date", "Check in", "Check out", "Worked", "Overtime", "Status"];

export function AttendanceHistoryTableRows({ records }: { records: ClassifiedAttendanceRecord[] }) {
  return (
    <>
      {records.map((record) => (
        <DataTableRow key={record.id}>
          <DataTableCell className="font-medium whitespace-nowrap">
            {formatDate(record.attendanceDate)}
          </DataTableCell>
          <DataTableCell className="tabular-nums">
            {record.checkIn ?? "—"}
            {record.late && <InlineTag label="Late" />}
          </DataTableCell>
          <DataTableCell className="tabular-nums">
            {record.checkOut ?? "—"}
            {record.earlyCheckout && <InlineTag label="Early" />}
          </DataTableCell>
          <DataTableCell
            className={cn("tabular-nums", isShortHoursDay(record) && "text-amber-700 font-semibold dark:text-amber-400")}
          >
            {minutesToHours(record.workedMinutes)}
          </DataTableCell>
          <DataTableCell className="tabular-nums">{minutesToHours(record.overtimeMinutes)}</DataTableCell>
          <DataTableCell>
            <CategoryBadge category={record.category} />
          </DataTableCell>
        </DataTableRow>
      ))}
    </>
  );
}

export function AttendanceHistoryTable({ records }: { records: ClassifiedAttendanceRecord[] }) {
  return (
    <DataTable columns={HISTORY_TABLE_COLUMNS}>
      <AttendanceHistoryTableRows records={records} />
    </DataTable>
  );
}
