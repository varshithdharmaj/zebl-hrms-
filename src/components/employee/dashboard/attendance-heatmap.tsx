"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarOff,
  Check,
  CircleAlert,
  Info,
  Palmtree,
  Star,
  X,
} from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, minutesToHours, toISODate } from "@/lib/utils";
import { calculateStreaks } from "@/lib/attendance/streak-calculator";
import {
  isWorkedDayCategory,
  type AttendanceDayResult,
} from "@/lib/attendance/day-classification";
import type { AttendanceHeatmapMonth } from "@/lib/attendance/heatmap-data";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  HEATMAP_COLOR,
  RATIO_TIER_COLOR,
  RATIO_TIER_LABEL,
  heatmapCellForeground,
  isExcellentTier,
} from "@/lib/attendance/day-labels";
import {
  buildHeatmapMonthStats,
  buildMonthWeekRanges,
  monthKeyFromDate,
  type HeatmapMonthStats,
  type MonthWeekRange,
} from "@/lib/attendance/heatmap-month-stats";

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

/** Preserve footprint: 26px cells, 3px gaps (Phase 8C). */
const CELL = 26;
const GAP = 3;
const STEP = CELL + GAP;
const WEEKDAY_GUTTER = 32; // matches `w-8` weekday label column
const MONTH_LABEL_ROW = 18;

export function isWorkedCategory(category: AttendanceDayResult["category"]): boolean {
  return isWorkedDayCategory(category);
}

/**
 * An active hover/focus interaction always wins over a pinned month. The pin
 * is only a fallback once hoveredMonthKey is genuinely null (no pointer/focus
 * interaction anywhere in the interactive wrapper — see `shouldClearHoverOnFocusOut`
 * and the wrapper's onMouseLeave, which are the only two places hoveredMonthKey
 * is cleared).
 */
export function resolveActiveMonthKey(
  hoveredMonthKey: string | null,
  pinnedMonthKey: string | null
): string | null {
  return hoveredMonthKey ?? pinnedMonthKey;
}

/** Click-to-pin toggles: clicking the already-pinned month unpins it. */
export function nextPinnedMonthKey(
  currentPinnedMonthKey: string | null,
  clickedMonthKey: string
): string | null {
  return currentPinnedMonthKey === clickedMonthKey ? null : clickedMonthKey;
}

/**
 * Keyboard focus can leave the interactive wrapper without any mouse event
 * ever firing (e.g. Tab past the last cell to the next section). Without this,
 * hoveredMonthKey could stay stuck on the last-focused month indefinitely,
 * permanently shadowing the pinned fallback. `relatedTarget` is the element
 * gaining focus; if it's outside the wrapper, the interaction has genuinely ended.
 */
export function shouldClearHoverOnFocusOut(
  container: { contains(node: Node | null): boolean },
  relatedTarget: Node | null
): boolean {
  return !container.contains(relatedTarget);
}

export function getCellColor(day: AttendanceDayResult): string {
  if (isWorkedDayCategory(day.category) && day.ratioTier) {
    return RATIO_TIER_COLOR[day.ratioTier];
  }
  return CATEGORY_COLOR[day.category] ?? HEATMAP_COLOR.empty;
}

export function buildTooltipText(day: AttendanceDayResult, expectedWorkMinutes: number): string {
  const dateLabel = day.date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const parts = [`${dateLabel}`, CATEGORY_LABEL[day.category]];

  if (isWorkedDayCategory(day.category)) {
    if (day.ratioTier) {
      parts.push(
        isExcellentTier(day.ratioTier) ? "Excellent" : "Below target",
        RATIO_TIER_LABEL[day.ratioTier]
      );
    }
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

function ContributionCell({
  day,
  expectedWorkMinutes,
  isSelected,
  isToday,
  dimmed,
  href,
  onMonthIntent,
}: {
  day: AttendanceDayResult;
  expectedWorkMinutes: number;
  isSelected: boolean;
  isToday: boolean;
  dimmed: boolean;
  href: string;
  onMonthIntent: (monthKey: string | null) => void;
}) {
  const color = getCellColor(day);
  const fg = heatmapCellForeground(
    isWorkedDayCategory(day.category) ? day.ratioTier : null
  );
  const tooltip = buildTooltipText(day, expectedWorkMinutes);
  const dateNum = day.date.getDate();
  const monthKey = monthKeyFromDate(day.date);

  return (
    <div
      className="group relative"
      data-month={monthKey}
      onMouseEnter={() => onMonthIntent(monthKey)}
      onFocusCapture={() => onMonthIntent(monthKey)}
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "relative flex h-[26px] w-[26px] items-center justify-center rounded-[5px] border border-black/5 transition-[opacity,box-shadow,background-color] duration-150 dark:border-white/10",
          "hover:z-10 hover:ring-2 hover:ring-primary/35",
          "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "motion-reduce:transition-none",
          isSelected && "z-10 ring-2 ring-primary",
          isToday && !isSelected && "z-[1] ring-2 ring-foreground/55 ring-offset-1 ring-offset-card",
          dimmed && "opacity-35"
        )}
        style={{ backgroundColor: color, color: fg }}
        aria-label={tooltip}
        aria-current={isToday ? "date" : undefined}
      >
        <span className="select-none text-[0.5rem] font-semibold tabular-nums opacity-90">
          {dateNum}
        </span>
      </Link>

      <div
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-xs -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-foreground opacity-0 shadow-elevated transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {tooltip}
      </div>
    </div>
  );
}

function LegendSwatch({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-[3px] border border-black/5 dark:border-white/10",
        className
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function HeatmapLegend() {
  return (
    <div className="mt-6 grid gap-6 border-t border-border pt-4 sm:grid-cols-3">
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Attendance
        </h4>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.present} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Check className="h-3 w-3 text-muted-foreground" aria-hidden />
                Below target
              </div>
              <p className="text-muted-foreground">Attended, under expected hours</p>
            </div>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.excellent} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Star className="h-3 w-3 text-muted-foreground" aria-hidden />
                Excellent
              </div>
              <p className="text-muted-foreground">Attended, met or exceeded expected hours</p>
            </div>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.absent} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <X className="h-3 w-3 text-muted-foreground" aria-hidden />
                Absent
              </div>
              <p className="text-muted-foreground">Expected working day, no attendance</p>
            </div>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.leave} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CalendarOff className="h-3 w-3 text-muted-foreground" aria-hidden />
                Leave
              </div>
              <p className="text-muted-foreground">Approved leave</p>
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Context
        </h4>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.holiday} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Palmtree className="h-3 w-3 text-muted-foreground" aria-hidden />
                Holiday
              </div>
              <p className="text-muted-foreground">Organisation holiday</p>
            </div>
          </li>
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.weeklyOff} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CalendarOff className="h-3 w-3 text-muted-foreground" aria-hidden />
                Weekly off
              </div>
              <p className="text-muted-foreground">Scheduled non-working day</p>
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Needs attention
        </h4>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2 text-xs">
            <LegendSwatch color={HEATMAP_COLOR.insufficient} />
            <div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CircleAlert className="h-3 w-3 text-muted-foreground" aria-hidden />
                Insufficient data
              </div>
              <p className="text-muted-foreground">Check-in without usable duration</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}

function MonthSummaryBar({ stats }: { stats: HeatmapMonthStats }) {
  const avg =
    stats.averageWorkedMinutes != null ? minutesToHours(stats.averageWorkedMinutes) : "—";
  const pct = stats.attendancePercent != null ? `${stats.attendancePercent}%` : "—";

  return (
    <div
      className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
      aria-live="polite"
    >
      <p className="text-xs font-semibold text-foreground">{stats.label} summary</p>
      <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>Attendance</dt>
          <dd className="font-medium text-foreground">{pct}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Present</dt>
          <dd className="font-medium text-foreground">{stats.presentDays}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Excellent</dt>
          <dd className="font-medium text-foreground">{stats.excellentDays}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Below target</dt>
          <dd className="font-medium text-foreground">{stats.belowTargetDays}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Absent</dt>
          <dd className="font-medium text-foreground">{stats.absentDays}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Leave</dt>
          <dd className="font-medium text-foreground">{stats.leaveDays}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Avg hours</dt>
          <dd className="font-medium text-foreground">{avg}</dd>
        </div>
      </dl>
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

function organizeIntoWeeks(days: AttendanceDayResult[]): (AttendanceDayResult | null)[][] {
  if (days.length === 0) return [];

  const weeks: (AttendanceDayResult | null)[][] = [];
  let currentWeek: (AttendanceDayResult | null)[] = Array(7).fill(null);
  let weekStarted = false;

  days.forEach((day) => {
    const dayOfWeek = day.date.getDay();

    if (dayOfWeek === 0 && weekStarted) {
      weeks.push(currentWeek);
      currentWeek = Array(7).fill(null);
    }

    currentWeek[dayOfWeek] = day;
    weekStarted = true;
  });

  if (currentWeek.some((d) => d !== null)) {
    weeks.push(currentWeek);
  }

  return weeks;
}

function getMonthLabels(weeks: (AttendanceDayResult | null)[][]): { label: string; weekIndex: number; monthKey: string }[] {
  const labels: { label: string; weekIndex: number; monthKey: string }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, weekIndex) => {
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return;

    const month = firstDay.date.getMonth();
    const year = firstDay.date.getFullYear();

    if (month !== lastMonth) {
      const monthName = firstDay.date.toLocaleDateString("en-IN", { month: "short" });
      const label = weekIndex === 0 ? `${monthName} ${year}` : monthName;
      labels.push({ label, weekIndex, monthKey: monthKeyFromDate(firstDay.date) });
      lastMonth = month;
    }
  });

  return labels;
}

function MonthWindowOverlay({
  range,
  weekCount,
}: {
  range: MonthWeekRange;
  weekCount: number;
}) {
  if (weekCount === 0) return null;
  const left = WEEKDAY_GUTTER + range.startWeek * STEP;
  const width = (range.endWeek - range.startWeek + 1) * STEP - GAP;
  const top = MONTH_LABEL_ROW + GAP;
  const height = 7 * STEP - GAP;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-0 rounded-lg transition-[opacity,transform] duration-200 motion-reduce:transition-none"
      style={{
        left,
        top,
        width,
        height,
        backgroundColor: "var(--heatmap-month-tint)",
        boxShadow: "inset 0 0 0 1px var(--heatmap-month-outline)",
      }}
    />
  );
}

export function AttendanceHeatmap({ month }: { month: AttendanceHeatmapMonth | null }) {
  const searchParams = useSearchParams();
  const selectedDate = searchParams.get("date");
  const today = useMemo(() => new Date(), []);

  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);
  const [pinnedMonthKey, setPinnedMonthKey] = useState<string | null>(null);

  const activeMonthKey = resolveActiveMonthKey(hoveredMonthKey, pinnedMonthKey);

  const derived = useMemo(() => {
    if (!month) return null;
    const weeks = organizeIntoWeeks(month.days);
    return {
      streaks: calculateStreaks(month.days, today),
      weeks,
      monthLabels: getMonthLabels(weeks),
      monthRanges: buildMonthWeekRanges(weeks),
      monthStats: buildHeatmapMonthStats(month.days),
    };
  }, [month, today]);

  const searchParamsString = searchParams.toString();
  const cellHref = useMemo(() => {
    return (day: AttendanceDayResult): string => {
      const params = new URLSearchParams(searchParamsString);
      params.set("date", toISODate(day.date));
      return `/employee/dashboard?${params.toString()}`;
    };
  }, [searchParamsString]);

  if (!month || !derived) {
    return <AttendanceHeatmapErrorNotice />;
  }

  const { streaks, weeks, monthLabels, monthRanges, monthStats } = derived;
  const { currentStreak, bestStreak, targetDaysCount } = streaks;
  const activeRange = activeMonthKey
    ? monthRanges.find((r) => r.monthKey === activeMonthKey) ?? null
    : null;
  const activeStats = activeMonthKey ? monthStats.get(activeMonthKey) ?? null : null;

  return (
    <SectionCard
      title="Attendance activity"
      description="Daily working-hour effectiveness over the current year"
      action={
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Hover a month for summary · click a day to select</span>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{targetDaysCount} excellent days</span>
        <span aria-hidden>·</span>
        <span>{currentStreak}-day streak</span>
        <span aria-hidden>·</span>
        <span>Best {bestStreak} days</span>
      </div>

      <div
        onMouseLeave={() => setHoveredMonthKey(null)}
        onBlur={(event) => {
          if (shouldClearHoverOnFocusOut(event.currentTarget, event.relatedTarget)) {
            setHoveredMonthKey(null);
          }
        }}
      >
        {activeStats && <MonthSummaryBar stats={activeStats} />}

        <div className="overflow-x-auto pb-2">
          <div className="relative inline-flex flex-col gap-[3px]">
          {activeRange && <MonthWindowOverlay range={activeRange} weekCount={weeks.length} />}

          <div className="relative z-[1] flex items-center gap-[3px] pl-9" style={{ minHeight: MONTH_LABEL_ROW }}>
            {weeks.map((_, weekIndex) => {
              const label = monthLabels.find((m) => m.weekIndex === weekIndex);
              return (
                <div key={weekIndex} className="w-[26px] text-left">
                  {label && (
                    <button
                      type="button"
                      className={cn(
                        "whitespace-nowrap text-[0.625rem] font-medium text-muted-foreground transition-colors",
                        "hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activeMonthKey === label.monthKey && "text-foreground"
                      )}
                      onMouseEnter={() => setHoveredMonthKey(label.monthKey)}
                      onFocus={() => setHoveredMonthKey(label.monthKey)}
                      onClick={() =>
                        setPinnedMonthKey((prev) => nextPinnedMonthKey(prev, label.monthKey))
                      }
                      aria-pressed={pinnedMonthKey === label.monthKey}
                      aria-label={`${label.label} summary`}
                    >
                      {label.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
            <div key={dayIndex} className="relative z-[1] flex items-center gap-[3px]">
              <div className="w-8 pr-1 text-right">
                <span className="text-[0.625rem] font-medium text-muted-foreground">
                  {WEEKDAY_LABELS[dayIndex]}
                </span>
              </div>

              {weeks.map((week, weekIndex) => {
                const day = week[dayIndex];
                if (!day) {
                  return <div key={weekIndex} className="h-[26px] w-[26px]" />;
                }

                const dayStr = toISODate(day.date);
                const isSelected = selectedDate === dayStr;
                const isToday =
                  day.date.getDate() === today.getDate() &&
                  day.date.getMonth() === today.getMonth() &&
                  day.date.getFullYear() === today.getFullYear();
                const dimmed = Boolean(
                  activeMonthKey && monthKeyFromDate(day.date) !== activeMonthKey
                );

                return (
                  <ContributionCell
                    key={`${weekIndex}-${dayIndex}`}
                    day={day}
                    expectedWorkMinutes={month.expectedWorkMinutes}
                    isSelected={isSelected}
                    isToday={isToday}
                    dimmed={dimmed}
                    href={cellHref(day)}
                    onMonthIntent={setHoveredMonthKey}
                  />
                );
              })}
            </div>
          ))}
          </div>
        </div>
      </div>

      {month.days.length === 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">No days to show for this period.</p>
      )}

      <HeatmapLegend />
    </SectionCard>
  );
}
