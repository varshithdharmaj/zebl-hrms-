import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
