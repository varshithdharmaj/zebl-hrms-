"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { cn, minutesToHours } from "@/lib/utils";
import type { AttendanceDayResult } from "@/lib/attendance/day-classification";
import type { AttendanceHeatmapMonth } from "@/lib/attendance/heatmap-data";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Validated sequential green ramp (light -> dark), one hue, ordinal check passed:
// lightness monotone, adjacent steps >= 0.06 L, light end clears 2:1 on white.
const RATIO_TIER_COLOR: Record<NonNullable<AttendanceDayResult["ratioTier"]>, string> = {
  very_low: "#10b981",
  partial: "#059669",
  near_target: "#047857",
  target: "#065f46",
  overtime: "#022c22",
};

const RATIO_TIER_LABEL: Record<NonNullable<AttendanceDayResult["ratioTier"]>, string> = {
  very_low: "Very low hours",
  partial: "Partial hours",
  near_target: "Near target",
  target: "Target hours",
  overtime: "Overtime",
};

const CATEGORY_LABEL: Record<AttendanceDayResult["category"], string> = {
  HOLIDAY: "Holiday",
  WEEKLY_OFF: "Weekly off",
  LEAVE: "Approved leave",
  ABSENT: "Absent",
  PRESENT: "Present",
  INSUFFICIENT_DATA: "Insufficient data",
  WORKED_ON_WEEKLY_OFF: "Worked on weekly off",
  WORKED_ON_HOLIDAY: "Worked on holiday",
};

function isWorkedCategory(category: AttendanceDayResult["category"]): boolean {
  return category === "PRESENT" || category === "WORKED_ON_WEEKLY_OFF" || category === "WORKED_ON_HOLIDAY";
}

function isWorkedOnOffDay(category: AttendanceDayResult["category"]): boolean {
  return category === "WORKED_ON_WEEKLY_OFF" || category === "WORKED_ON_HOLIDAY";
}

function getCellStyle(day: AttendanceDayResult): { className: string; style?: React.CSSProperties } {
  if (isWorkedCategory(day.category) && day.ratioTier) {
    return {
      className: "text-white",
      style: { backgroundColor: RATIO_TIER_COLOR[day.ratioTier] },
    };
  }
  switch (day.category) {
    case "HOLIDAY":
      return { className: "bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300" };
    case "WEEKLY_OFF":
      return {
        className: "text-slate-500 ring-1 ring-inset ring-slate-200",
        style: {
          backgroundImage:
            "repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 4px, #e2e8f0 4px, #e2e8f0 8px)",
        },
      };
    case "LEAVE":
      return { className: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20" };
    case "ABSENT":
      return { className: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20" };
    case "INSUFFICIENT_DATA":
      return { className: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20" };
    default:
      return { className: "bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200" };
  }
}

function buildTooltipText(day: AttendanceDayResult): string {
  const dateLabel = day.date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const parts = [`${dateLabel}`, CATEGORY_LABEL[day.category]];

  if (isWorkedCategory(day.category)) {
    if (day.ratioTier) parts.push(RATIO_TIER_LABEL[day.ratioTier]);
    parts.push(`Worked: ${minutesToHours(day.workedMinutes)}`);
    if (day.overtimeMinutes > 0) parts.push(`Overtime: ${minutesToHours(day.overtimeMinutes)}`);
    if (day.checkIn) parts.push(`Check-in: ${day.checkIn}`);
    if (day.checkOut) parts.push(`Check-out: ${day.checkOut}`);
  }
  if (day.category === "HOLIDAY" || day.category === "WORKED_ON_HOLIDAY") {
    if (day.holidayName) parts.push(`Holiday: ${day.holidayName}`);
  }
  if (day.category === "LEAVE" && day.leaveType) {
    parts.push(`Leave type: ${day.leaveType}`);
  }
  if (day.remark) parts.push(`Remarks: ${day.remark}`);
  if (day.hasLeaveConflict) {
    parts.push("Attendance recorded on an approved leave date.");
  }

  return parts.join(" · ");
}

function HeatmapCell({ day }: { day: AttendanceDayResult }) {
  const { className, style } = getCellStyle(day);
  const tooltip = buildTooltipText(day);
  const dayNumber = day.date.getDate();

  return (
    <div className="group relative">
      <button
        type="button"
        className={cn(
          "flex h-9 w-full items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus:z-10 hover:scale-[1.06]",
          className
        )}
        style={style}
        aria-label={tooltip}
        title={tooltip}
      >
        {dayNumber}
        {isWorkedOnOffDay(day.category) && (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-white ring-1 ring-slate-900/30"
          />
        )}
      </button>

      <div
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[15rem] -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-foreground opacity-0 shadow-elevated transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {tooltip}
      </div>
    </div>
  );
}

const LEGEND_ITEMS: { label: string; className: string; style?: React.CSSProperties }[] = [
  { label: "No data", className: "bg-slate-50 ring-1 ring-inset ring-slate-200" },
  {
    label: "Weekly off",
    className: "ring-1 ring-inset ring-slate-200",
    style: {
      backgroundImage:
        "repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 4px, #e2e8f0 4px, #e2e8f0 8px)",
    },
  },
  { label: "Holiday", className: "bg-slate-200 ring-1 ring-inset ring-slate-300" },
  { label: "Leave", className: "bg-violet-50 ring-1 ring-inset ring-violet-600/20" },
  { label: "Absent", className: "bg-rose-50 ring-1 ring-inset ring-rose-600/20" },
  { label: "Insufficient data", className: "bg-amber-50 ring-1 ring-inset ring-amber-600/20" },
  { label: "Very low hours", className: "", style: { backgroundColor: RATIO_TIER_COLOR.very_low } },
  { label: "Target hours", className: "", style: { backgroundColor: RATIO_TIER_COLOR.target } },
  { label: "Overtime", className: "", style: { backgroundColor: RATIO_TIER_COLOR.overtime } },
];

export function AttendanceHeatmap({ month }: { month: AttendanceHeatmapMonth }) {
  const searchParams = useSearchParams();

  function monthHref(targetMonthKey: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("heatmapMonth", targetMonthKey);
    return `/employee/dashboard?${params.toString()}`;
  }

  const firstDate = month.days[0]?.date ?? new Date();
  const leadingBlanks = firstDate.getDay();

  return (
    <SectionCard
      title="Attendance heatmap"
      description="Daily working-hour effectiveness for the month."
      action={
        <div className="flex items-center gap-1">
          <Link
            href={monthHref(month.prevMonthKey)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-slate-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[8rem] text-center text-sm font-medium text-foreground">
            {month.monthLabel}
          </span>
          <Link
            href={monthHref(month.nextMonthKey)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-slate-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      }
    >
      <div className="mb-3 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={`${label}-${i}`}
            className="flex h-6 items-center justify-center text-[0.6875rem] font-semibold uppercase text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {month.days.map((day) => (
          <HeatmapCell key={day.date.toISOString()} day={day} />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className={cn("h-3 w-3 rounded-sm", item.className)}
              style={item.style}
              aria-hidden
            />
            {item.label}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
