import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { kpiAccentStyles, type KpiAccent } from "@/lib/kpi-accents";
import type { LucideIcon } from "lucide-react";

export function DashboardCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "blue",
  className,
  children,
}: {
  label: string;
  value?: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: KpiAccent;
  className?: string;
  children?: ReactNode;
}) {
  const colors = kpiAccentStyles[accent];

  return (
    <article
      className={cn(
        "group flex h-full min-h-[7.5rem] flex-col rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-card transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-elevated",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-medium leading-snug text-muted-foreground">{label}</p>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-4 transition-transform group-hover:scale-105",
              colors.icon,
              colors.ring
            )}
          >
            <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="mt-auto pt-4">
        {children ?? (
          <>
            <p className="text-[1.875rem] font-semibold leading-none tracking-tight text-foreground tabular-nums">
              {value}
            </p>
            {hint && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{hint}</p>}
          </>
        )}
      </div>
    </article>
  );
}
