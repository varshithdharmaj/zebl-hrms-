import { Suspense } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardToolbar } from "@/components/employee/dashboard-toolbar";
import { Sparkles } from "lucide-react";

export function DashboardWelcome({
  firstName,
  fullName,
  displayDate,
  dateIso,
  status,
  defaultDate,
  defaultStart,
  defaultEnd,
}: {
  firstName: string;
  fullName: string | null;
  displayDate: string;
  dateIso: string;
  status: string;
  defaultDate: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-card lg:p-8">
      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-muted px-3 py-1 text-xs font-medium text-primary">
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

          <StatusBadge status={status} />
        </div>

        <div className="w-full shrink-0 rounded-xl border border-border bg-muted/40 p-5 xl:w-[min(100%,22rem)]">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Filters
          </p>
          <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted" />}>
            <DashboardToolbar
              defaultDate={defaultDate}
              defaultStart={defaultStart}
              defaultEnd={defaultEnd}
              layout="compact"
            />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
