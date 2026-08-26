import { cn } from "@/lib/utils";
import {
  formatEmployeeShiftDisplay,
  formatShiftTimeRange,
  getEmployeeShiftBadgeVariant,
} from "@/lib/attendance-shift";

const badgeStyles: Record<string, string> = {
  morning: "bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-200",
  night: "bg-indigo-500/10 text-indigo-800 ring-indigo-500/20 dark:text-indigo-200",
  us: "bg-sky-500/10 text-sky-800 ring-sky-500/20 dark:text-sky-200",
  general: "bg-muted text-muted-foreground ring-border",
  default: "bg-muted text-muted-foreground ring-border",
};

/** Shows Employee.shift (assigned profile shift), optional in/out range for compact layouts */
export function AttendanceShiftCell({
  shift,
  checkIn,
  checkOut,
  showTimeRange = false,
  compact = false,
}: {
  /** Employee.shift from profile */
  shift: string | null | undefined;
  checkIn?: string | null;
  checkOut?: string | null;
  showTimeRange?: boolean;
  compact?: boolean;
}) {
  const label = formatEmployeeShiftDisplay(shift);
  const variant = getEmployeeShiftBadgeVariant(shift);
  const range = showTimeRange ? formatShiftTimeRange(checkIn, checkOut) : "";

  if (label === "—" && !range) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className={cn("space-y-1", compact && "space-y-0.5")}>
      {label !== "—" && (
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
            badgeStyles[variant]
          )}
        >
          {label}
        </span>
      )}
      {range && (
        <p className={cn("tabular-nums text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {range}
        </p>
      )}
    </div>
  );
}
