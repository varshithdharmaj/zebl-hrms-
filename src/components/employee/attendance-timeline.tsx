import { LogIn, LogOut, Clock, Timer, CheckCircle2, CalendarX2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { minutesToHours } from "@/lib/utils";
import { cn } from "@/lib/utils";

const steps = [
  { key: "checkIn", icon: LogIn, label: "Check in", accent: "bg-accent-blue-muted text-accent-blue" },
  { key: "checkOut", icon: LogOut, label: "Check out", accent: "bg-accent-violet-muted text-accent-violet" },
  { key: "worked", icon: Clock, label: "Worked", accent: "bg-accent-green-muted text-accent-green" },
  { key: "overtime", icon: Timer, label: "Overtime", accent: "bg-accent-amber-muted text-accent-amber" },
] as const;

export function AttendanceTimeline({
  checkIn,
  checkOut,
  workedMinutes,
  overtimeMinutes,
  status,
  selectedDateLabel,
}: {
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  status: string;
  selectedDateLabel?: string;
}) {
  const values: Record<string, { value: string; active: boolean }> = {
    checkIn: { value: checkIn ?? "—", active: Boolean(checkIn) },
    checkOut: { value: checkOut ?? "—", active: Boolean(checkOut) },
    worked: { value: minutesToHours(workedMinutes), active: workedMinutes > 0 },
    overtime: { value: minutesToHours(overtimeMinutes), active: overtimeMinutes > 0 },
  };

  const isPresent = status.toLowerCase() === "present";
  const hasNoRecord = status === "No Record";

  return (
    <SectionCard
      title="Today's attendance"
      description={selectedDateLabel ?? "Selected day"}
      action={<StatusBadge status={status} />}
      className="h-full"
    >
      {hasNoRecord && (
        <EmptyState
          icon={CalendarX2}
          title="No attendance record for this day"
          description="Check back after attendance is uploaded, or select a different date."
        />
      )}

      {!hasNoRecord && isPresent && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-success/20 bg-success-muted px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-semibold text-success">You&apos;re on track today</p>
            <p className="mt-0.5 text-xs text-success/80">
              Full day logged with {minutesToHours(workedMinutes)} worked.
            </p>
          </div>
        </div>
      )}

      {!hasNoRecord && (
        <>
          <div className="hidden md:block">
            <div className="relative grid grid-cols-4 gap-4">
              <div
                className="pointer-events-none absolute left-[12%] right-[12%] top-7 h-px bg-gradient-to-r from-border via-primary/30 to-border"
                aria-hidden
              />
              {steps.map((step) => {
                const Icon = step.icon;
                const { value, active } = values[step.key];
                return (
                  <div key={step.key} className="relative flex flex-col items-center text-center">
                    <div
                      className={cn(
                        "relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-subtle",
                        !active && "opacity-60"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          active ? step.accent : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="mt-4 text-xs font-medium text-muted-foreground">{step.label}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                      {value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <ul className="space-y-4 md:hidden">
            {steps.map((step) => {
              const Icon = step.icon;
              const { value, active } = values[step.key];
              return (
                <li key={step.key} className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      active ? step.accent : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                    <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
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
