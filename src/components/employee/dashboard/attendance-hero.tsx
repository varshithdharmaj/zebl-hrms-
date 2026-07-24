import { Suspense } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  LogIn,
  LogOut,
  Clock,
  Hourglass,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardDateRangeFilter } from "@/components/employee/dashboard/dashboard-date-range-filter";
import { cn } from "@/lib/utils";
import type { HeroStatus, HeroTone } from "@/lib/attendance/hero-status";

const TONE_STYLES: Record<
  HeroTone,
  { border: string; bg: string; dot: string; text: string; bar: string }
> = {
  success: {
    border: "border-success/25",
    bg: "bg-success-muted",
    dot: "bg-success",
    text: "text-success",
    bar: "bg-success",
  },
  info: {
    border: "border-accent-blue/25",
    bg: "bg-accent-blue-muted",
    dot: "bg-accent-blue",
    text: "text-accent-blue",
    bar: "bg-accent-blue",
  },
  warning: {
    border: "border-warning/25",
    bg: "bg-warning-muted",
    dot: "bg-warning",
    text: "text-warning",
    bar: "bg-warning",
  },
  danger: {
    border: "border-danger/25",
    bg: "bg-danger-muted",
    dot: "bg-danger",
    text: "text-danger",
    bar: "bg-danger",
  },
  neutral: {
    border: "border-border",
    bg: "bg-muted/40",
    dot: "bg-slate-400",
    text: "text-foreground",
    bar: "bg-slate-400",
  },
};

function StatField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}

function BadgePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-subtle ring-1 ring-border">
      {label}
    </span>
  );
}

export function AttendanceHero({
  firstName,
  fullName,
  displayDate,
  dateIso,
  heroStatus,
  defaultStart,
  defaultEnd,
}: {
  firstName: string;
  fullName: string | null;
  displayDate: string;
  dateIso: string;
  /** null = the status computation failed; the hero renders a scoped error + retry. */
  heroStatus: HeroStatus | null;
  defaultStart: string;
  defaultEnd: string;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const tone = TONE_STYLES[heroStatus?.tone ?? "neutral"];

  const badgeLabels: string[] = heroStatus
    ? [
        heroStatus.badges.late ? "Late arrival" : null,
        heroStatus.badges.earlyCheckout ? "Early checkout" : null,
        heroStatus.badges.overtime ? "Overtime" : null,
        heroStatus.badges.shortHours ? "Short hours" : null,
        heroStatus.badges.leaveConflict ? "Attendance recorded on leave date" : null,
      ].filter((b): b is string => Boolean(b))
    : [];

  const hasStatRow = Boolean(
    heroStatus &&
      (heroStatus.checkInTime || heroStatus.checkOutTime || heroStatus.workedLabel || heroStatus.remainingLabel)
  );

  return (
    <section
      aria-label="Today's attendance status"
      className={cn(
        "rounded-[var(--radius-card)] border p-6 shadow-card lg:p-8",
        tone.border,
        tone.bg
      )}
    >
      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground shadow-subtle">
            <Sparkles className="h-3.5 w-3.5" />
            <time dateTime={dateIso}>{displayDate}</time>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{greeting},</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {firstName}
              {fullName && fullName !== firstName ? (
                <span className="text-muted-foreground"> · {fullName.split(" ").slice(1).join(" ")}</span>
              ) : null}
            </h1>
          </div>

          {heroStatus ? (
            <>
              <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-3">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", tone.dot)} aria-hidden />
                <p className={cn("text-2xl font-bold leading-tight sm:text-3xl", tone.text)}>
                  {heroStatus.label}
                </p>
              </div>

              {heroStatus.subLabel && (
                <p className="text-sm text-muted-foreground">{heroStatus.subLabel}</p>
              )}

              {badgeLabels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {badgeLabels.map((label) => (
                    <BadgePill key={label} label={label} />
                  ))}
                </div>
              )}

              {hasStatRow && (
                <dl className="flex flex-wrap gap-x-8 gap-y-3 pt-1">
                  {heroStatus.checkInTime && (
                    <StatField icon={LogIn} label="Check-in" value={heroStatus.checkInTime} />
                  )}
                  {heroStatus.checkOutTime && (
                    <StatField icon={LogOut} label="Check-out" value={heroStatus.checkOutTime} />
                  )}
                  {heroStatus.workedLabel && (
                    <StatField icon={Clock} label="Worked" value={heroStatus.workedLabel} />
                  )}
                  {heroStatus.remainingLabel && (
                    <StatField icon={Hourglass} label="Remaining" value={heroStatus.remainingLabel} />
                  )}
                </dl>
              )}

              {heroStatus.progressPercent !== null && (
                <div className="max-w-sm space-y-1.5 pt-1">
                  <div
                    role="progressbar"
                    aria-valuenow={Math.min(100, Math.max(0, heroStatus.progressPercent))}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuetext={`${heroStatus.progressPercent}% of target hours`}
                    className="h-2 overflow-hidden rounded-full bg-card"
                  >
                    <div
                      className={cn("h-full rounded-full transition-[width]", tone.bar)}
                      style={{ width: `${Math.min(100, Math.max(0, heroStatus.progressPercent))}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {heroStatus.progressPercent}% of target hours
                  </p>
                </div>
              )}

              {heroStatus.actionHint && (
                <p className="text-xs text-muted-foreground">{heroStatus.actionHint}</p>
              )}
            </>
          ) : (
            <AttendanceHeroErrorNotice />
          )}

          <div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/employee/attendance">
                View attendance history
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="w-full shrink-0 rounded-xl border border-border bg-card/60 p-5 xl:w-[min(100%,22rem)]">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Date range
          </p>
          <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
            <DashboardDateRangeFilter
              defaultStart={defaultStart}
              defaultEnd={defaultEnd}
              defaultPreset="this-month"
            />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function AttendanceHeroErrorNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-card px-4 py-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div>
        <p className="text-sm font-semibold text-foreground">
          Couldn&apos;t load today&apos;s attendance status
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The rest of your dashboard is unaffected.{" "}
          <a href="?" className="font-medium text-foreground underline underline-offset-2">
            Retry
          </a>
        </p>
      </div>
    </div>
  );
}

export function AttendanceHeroSkeleton() {
  return (
    <section
      aria-hidden
      className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-card lg:p-8"
    >
      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-5">
          <Skeleton className="h-6 w-40 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-56" />
          </div>
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-8">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
          <Skeleton className="h-2 w-full max-w-sm rounded-full" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl xl:w-[min(100%,22rem)]" />
      </div>
    </section>
  );
}
