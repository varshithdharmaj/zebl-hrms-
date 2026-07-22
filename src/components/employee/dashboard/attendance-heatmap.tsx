"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, minutesToHours } from "@/lib/utils";
import { calculateStreaks } from "@/lib/attendance/streak-calculator";
import type { AttendanceDayResult } from "@/lib/attendance/day-classification";
import type { AttendanceHeatmapMonth } from "@/lib/attendance/heatmap-data";
import {
  CATEGORY_LABEL,
  RATIO_TIER_COLOR,
  RATIO_TIER_LABEL,
} from "@/lib/attendance/day-labels";

// GitHub-style weekday labels
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function isWorkedCategory(category: AttendanceDayResult["category"]): boolean {
  return category === "PRESENT" || category === "WORKED_ON_WEEKLY_OFF" || category === "WORKED_ON_HOLIDAY";
}

// Simplified 4-tier color mapping — muted, professional, theme-compatible
export function getCellColor(day: AttendanceDayResult): string {
  if (isWorkedCategory(day.category) && day.ratioTier) {
    return RATIO_TIER_COLOR[day.ratioTier];
  }
  switch (day.category) {
    case "HOLIDAY":
      return "#71717a"; // Neutral muted gray
    case "WEEKLY_OFF":
      return "#52525b"; // Subtle neutral gray
    case "LEAVE":
      return "#be123c"; // Muted rose/pink
    case "ABSENT":
      return "#991b1b"; // Muted red
    case "INSUFFICIENT_DATA":
      return "#d97706"; // Muted amber
    default:
      return "#18181b"; // Dark neutral (no data)
  }
}

export function buildTooltipText(day: AttendanceDayResult, expectedWorkMinutes: number): string {
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
    if (expectedWorkMinutes > 0) parts.push(`Expected: ${minutesToHours(expectedWorkMinutes)}`);
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

// Compact activity cell with small date number
function ContributionCell({
  day,
  expectedWorkMinutes,
  isSelected,
  isToday,
  href,
}: {
  day: AttendanceDayResult;
  expectedWorkMinutes: number;
  isSelected: boolean;
  isToday: boolean;
  href: string;
}) {
  const color = getCellColor(day);
  const tooltip = buildTooltipText(day, expectedWorkMinutes);
  const dateNum = day.date.getDate();

  return (
    <div className="group relative">
      <Link
        href={href}
        scroll={false}
        className={cn(
          // Compact cell: 26px square, 6px radius, 3px gap (preserved from Phase 8C)
          "relative flex items-center justify-center h-[26px] w-[26px] rounded-md transition-all duration-150",
          "hover:ring-2 hover:ring-primary/40 hover:scale-105 hover:z-10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:z-10",
          // Selected/today indicators
          isSelected && "ring-2 ring-primary scale-105",
          isToday && !isSelected && "ring-1 ring-primary/50"
        )}
        style={{ backgroundColor: color }}
        aria-label={tooltip}
        title={tooltip}
        aria-current={isToday ? "date" : undefined}
      >
        <span className="text-[0.5rem] font-medium text-white/90 dark:text-white/80 select-none">
          {dateNum}
        </span>
      </Link>

      <div
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-xs -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-foreground opacity-0 shadow-xl transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {tooltip}
      </div>
    </div>
  );
}

function AttendanceHeatmapErrorNotice() {
  return (
    <SectionCard title="Attendance activity" description="Daily working-hour effectiveness over the current year.">
      <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning-muted px-4 py-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-semibold text-foreground">Couldn&apos;t load the attendance heatmap</p>
          <p className="mt-0.5 text-xs text-muted-foreground">The rest of your dashboard is unaffected.</p>
        </div>
      </div>
    </SectionCard>
  );
}

export function AttendanceHeatmapSkeleton() {
  return (
    <section aria-hidden className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="mb-4 h-4 w-72" />
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="h-[26px] w-[26px] rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="mt-6 h-32 w-full" />
    </section>
  );
}

// Organize 12-month data into GitHub-style calendar weeks
function organizeIntoWeeks(days: AttendanceDayResult[]): (AttendanceDayResult | null)[][] {
  if (days.length === 0) return [];

  const weeks: (AttendanceDayResult | null)[][] = [];
  let currentWeek: (AttendanceDayResult | null)[] = Array(7).fill(null);
  let weekStarted = false;

  days.forEach((day) => {
    const dayOfWeek = day.date.getDay(); // 0 = Sunday

    // Start new week on Sunday
    if (dayOfWeek === 0 && weekStarted) {
      weeks.push(currentWeek);
      currentWeek = Array(7).fill(null);
    }

    currentWeek[dayOfWeek] = day;
    weekStarted = true;
  });

  // Push remaining week if it has any days
  if (currentWeek.some((d) => d !== null)) {
    weeks.push(currentWeek);
  }

  return weeks;
}

// Get month labels with their week positions
function getMonthLabels(weeks: (AttendanceDayResult | null)[][]): { label: string; weekIndex: number }[] {
  const labels: { label: string; weekIndex: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, weekIndex) => {
    // Find the first non-null day in this week
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return;

    const month = firstDay.date.getMonth();
    const year = firstDay.date.getFullYear();

    // Add label if this is a new month
    if (month !== lastMonth) {
      const monthName = firstDay.date.toLocaleDateString("en-IN", { month: "short" });
      const label = weekIndex === 0 ? `${monthName} ${year}` : monthName;
      labels.push({ label, weekIndex });
      lastMonth = month;
    }
  });

  return labels;
}

export function AttendanceHeatmap({ month }: { month: AttendanceHeatmapMonth | null }) {
  const searchParams = useSearchParams();
  const selectedDate = searchParams.get("date");
  const today = new Date();

  function cellHref(day: AttendanceDayResult): string {
    const params = new URLSearchParams(searchParams.toString());
    const dateStr = day.date.toISOString().split("T")[0];
    params.set("date", dateStr!);
    return `/employee/dashboard?${params.toString()}`;
  }

  if (!month) {
    return <AttendanceHeatmapErrorNotice />;
  }

  // Calculate streaks and summary metrics from year-to-date dataset
  const { currentStreak, bestStreak, targetDaysCount } = calculateStreaks(month.days, today);

  // Organize into calendar weeks
  const weeks = organizeIntoWeeks(month.days);
  const monthLabels = getMonthLabels(weeks);

  return (
    <SectionCard
      title="Attendance activity"
      description="Daily working-hour effectiveness over the current year"
      action={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current">i</span>
            Click any day to select
          </span>
        </div>
      }
    >
      {/* Compact summary */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{targetDaysCount} days at 8+ hours</span>
        <span aria-hidden>·</span>
        <span>{currentStreak}-day streak</span>
        <span aria-hidden>·</span>
        <span>Best {bestStreak} days</span>
      </div>

      {/* Year-to-date contribution graph */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex flex-col gap-[3px]">
          {/* Month labels */}
          <div className="flex items-center gap-[3px] pl-9">
            {weeks.map((_, weekIndex) => {
              const label = monthLabels.find((m) => m.weekIndex === weekIndex);
              return (
                <div key={weekIndex} className="w-[26px] text-left">
                  {label && (
                    <span className="whitespace-nowrap text-[0.625rem] font-medium text-muted-foreground">
                      {label.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Weekday rows */}
          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
            <div key={dayIndex} className="flex items-center gap-[3px]">
              {/* Weekday label */}
              <div className="w-8 text-right pr-1">
                <span className="text-[0.625rem] font-medium text-muted-foreground">
                  {WEEKDAY_LABELS[dayIndex]}
                </span>
              </div>

              {/* Cells for this weekday across all weeks */}
              {weeks.map((week, weekIndex) => {
                const day = week[dayIndex];
                if (!day) {
                  return <div key={weekIndex} className="h-[26px] w-[26px]" />;
                }

                const dayStr = day.date.toISOString().split("T")[0];
                const isSelected = selectedDate === dayStr;
                const isToday =
                  day.date.getDate() === today.getDate() &&
                  day.date.getMonth() === today.getMonth() &&
                  day.date.getFullYear() === today.getFullYear();

                return (
                  <ContributionCell
                    key={`${weekIndex}-${dayIndex}`}
                    day={day}
                    expectedWorkMinutes={month.expectedWorkMinutes}
                    isSelected={isSelected}
                    isToday={isToday}
                    href={cellHref(day)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {month.days.length === 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">No days to show for this period.</p>
      )}

      {/* Two-column legend matching reference design */}
      <div className="mt-6 grid gap-6 border-t border-border pt-4 sm:grid-cols-2">
        {/* WORKED DURATION */}
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Worked Duration
          </h4>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm bg-[#991b1b]" aria-hidden />
              <div className="text-xs">
                <div className="font-medium text-foreground">Very low</div>
                <div className="text-muted-foreground">&lt; 3h</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm bg-[#c2410c]" aria-hidden />
              <div className="text-xs">
                <div className="font-medium text-foreground">Partial</div>
                <div className="text-muted-foreground">3h – 5h</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm bg-[#65a30d]" aria-hidden />
              <div className="text-xs">
                <div className="font-medium text-foreground">Near target</div>
                <div className="text-muted-foreground">5h – 7h 59m</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm bg-[#15803d]" aria-hidden />
              <div className="text-xs">
                <div className="font-medium text-foreground">Target met</div>
                <div className="text-muted-foreground">≥ 8h</div>
              </div>
            </div>
          </div>
        </div>

        {/* CONTEXT */}
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Context
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-[#be123c]" aria-hidden />
              <span className="font-medium text-foreground">Leave</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-[#71717a]" aria-hidden />
              <span className="font-medium text-foreground">Holiday</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-[#52525b]" aria-hidden />
              <span className="font-medium text-foreground">Weekly off</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span
                className="h-3 w-3 shrink-0 rounded-sm bg-[#d97706] opacity-60"
                style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, currentColor 2px, currentColor 3px)" }}
                aria-hidden
              />
              <span className="font-medium text-foreground">Insufficient data</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 shrink-0 rounded-sm border-2 border-[#991b1b]" aria-hidden />
              <span className="font-medium text-foreground">Absent</span>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
