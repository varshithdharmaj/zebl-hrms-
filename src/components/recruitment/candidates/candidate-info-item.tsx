import React from "react";
import { cn } from "@/lib/utils";

export interface CandidateInfoItemProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export function CandidateInfoItem({
  label,
  value,
  icon: Icon,
  className,
}: CandidateInfoItemProps) {
  return (
    <div
      className={cn(
        "space-y-1 p-3 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors duration-150",
        className
      )}
    >
      <dt className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/80" />}
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground break-words">
        {value || "—"}
      </dd>
    </div>
  );
}
