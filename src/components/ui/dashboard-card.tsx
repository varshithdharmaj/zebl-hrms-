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
        "group flex h-full min-h-[7.25rem] flex-col rounded-xl border border-border bg-card p-5 shadow-subtle transition-colors duration-150",
        "hover:border-slate-300",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        {Icon && (
          <div
            className={cn(
              "flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg text-sm transition-colors",
              colors.icon
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="mt-auto pt-3">
        {children ?? (
          <>
            <p className="text-2xl font-bold leading-none tracking-tight text-slate-900 tabular-nums">
              {value}
            </p>
            {hint && <p className="mt-1.5 line-clamp-2 text-xs font-medium text-slate-500">{hint}</p>}
          </>
        )}
      </div>
    </article>
  );
}
