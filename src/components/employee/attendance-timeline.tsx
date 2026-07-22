import {
  LogIn,
  LogOut,
  Clock,
  Timer,
  AlertTriangle,
  CalendarX2,
  PartyPopper,
  Moon,
  Palmtree,
  AlertCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, minutesToHours } from "@/lib/utils";
import type { HeroStatus } from "@/lib/attendance/hero-status";

function StepTag({ label }: { label: string }) {
  return (
    <span className="mt-1 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function buildSteps(heroStatus: HeroStatus, overtimeMinutes: number, expectedWorkMinutes: number | null) {
  return [
    {
      key: "checkIn",
      icon: LogIn,
      label: "Check in",
      accent: "bg-accent-blue-muted text-accent-blue",
      value: heroStatus.checkInTime ?? "—",
      active: Boolean(heroStatus.checkInTime),
      tag: heroStatus.badges.late ? "Late" : null,
      caption: null as string | null,
    },
    {
      key: "checkOut",
      icon: LogOut,
      label: "Check out",
      accent: "bg-accent-violet-muted text-accent-violet",
      value: heroStatus.checkOutTime ?? "—",
      active: Boolean(heroStatus.checkOutTime),
      tag: heroStatus.badges.earlyCheckout ? "Early" : null,
      caption: null as string | null,
    },
    {
      key: "worked",
      icon: Clock,
      label: "Worked",
      accent: "bg-accent-green-muted text-accent-green",
      value: heroStatus.workedLabel ?? "—",
      active: Boolean(heroStatus.workedLabel),
      tag: heroStatus.badges.shortHours ? "Short hours" : null,
      caption:
        heroStatus.workedLabel && expectedWorkMinutes
          ? `of ${minutesToHours(expectedWorkMinutes)} expected`
          : null,
    },
    {
      key: "overtime",
      icon: Timer,
      label: "Overtime",
      accent: "bg-accent-amber-muted text-accent-amber",
      value: minutesToHours(overtimeMinutes),
      active: overtimeMinutes > 0,
      tag: null as string | null,
      caption: null as string | null,
    },
  ] as const;
}

function EmptyDayNotice({ heroStatus, isToday }: { heroStatus: HeroStatus; isToday: boolean }) {
  switch (heroStatus.category) {
    case "HOLIDAY":
      return (
        <EmptyState
          icon={PartyPopper}
          title={heroStatus.label}
          description={heroStatus.subLabel ?? "Enjoy your day off."}
        />
      );
    case "WEEKLY_OFF":
      return (
        <EmptyState
          icon={Moon}
          title={heroStatus.label}
          description="No attendance is expected today."
        />
      );
    case "LEAVE":
      return (
        <EmptyState
          icon={Palmtree}
          title={heroStatus.label}
          description={heroStatus.subLabel ?? "Approved leave for this day."}
        />
      );
    case "ABSENT":
    default:
      return (
        <EmptyState
          icon={CalendarX2}
          title={heroStatus.label}
          description={
            isToday
              ? "Your attendance hasn't been recorded yet."
              : "No attendance was recorded for this day."
          }
        />
      );
  }
}

export function AttendanceTimeline({
  heroStatus,
  overtimeMinutes,
  expectedWorkMinutes,
  isToday,
  selectedDateLabel,
}: {
  /** null = the shared classification failed to load — see AttendanceHero's identical signal. */
  heroStatus: HeroStatus | null;
  overtimeMinutes: number;
  expectedWorkMinutes: number | null;
  isToday: boolean;
  selectedDateLabel?: string;
}) {
  const title = isToday ? "Today's attendance" : "Attendance details";

  if (!heroStatus) {
    return (
      <SectionCard title={title} description={selectedDateLabel ?? "Selected day"} className="h-full">
        <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning-muted px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Couldn&apos;t load attendance details
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your overall status above may still be available.
            </p>
          </div>
        </div>
      </SectionCard>
    );
  }

  const hasCheckIn = Boolean(heroStatus.checkInTime);
  const steps = buildSteps(heroStatus, overtimeMinutes, expectedWorkMinutes);

  const contextNote =
    heroStatus.category === "WORKED_ON_HOLIDAY" || heroStatus.category === "WORKED_ON_WEEKLY_OFF"
      ? heroStatus.subLabel
      : null;

  return (
    <SectionCard
      title={title}
      description={selectedDateLabel ?? "Selected day"}
      action={<StatusBadge status={heroStatus.label} />}
      className="h-full"
    >
      {!hasCheckIn && <EmptyDayNotice heroStatus={heroStatus} isToday={isToday} />}

      {hasCheckIn && heroStatus.badges.leaveConflict && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/25 bg-warning-muted px-4 py-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm font-medium text-warning">
            Attendance was recorded on a date with approved leave.
          </p>
        </div>
      )}

      {hasCheckIn && contextNote && (
        <p className="mb-4 text-sm text-muted-foreground">{contextNote}</p>
      )}

      {hasCheckIn && (
        <>
          <div className="hidden md:block">
            <div className="relative grid grid-cols-4 gap-4">
              <div
                className="pointer-events-none absolute left-[12%] right-[12%] top-7 h-px bg-gradient-to-r from-border via-primary/30 to-border"
                aria-hidden
              />
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.key} className="relative flex flex-col items-center text-center">
                    <div
                      className={cn(
                        "relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-subtle",
                        !step.active && "opacity-60"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          step.active ? step.accent : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="mt-4 text-xs font-medium text-muted-foreground">{step.label}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                      {step.value}
                    </p>
                    {step.caption && (
                      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{step.caption}</p>
                    )}
                    {step.tag && <StepTag label={step.tag} />}
                  </div>
                );
              })}
            </div>
          </div>

          <ul className="space-y-4 md:hidden">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.key}
                  className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      step.active ? step.accent : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                    <p className="text-lg font-semibold tabular-nums text-foreground">{step.value}</p>
                    {step.caption && (
                      <p className="text-[0.6875rem] text-muted-foreground">{step.caption}</p>
                    )}
                    {step.tag && <StepTag label={step.tag} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
