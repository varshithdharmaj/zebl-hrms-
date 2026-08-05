import React from "react";
import { cn } from "@/lib/utils";

export interface CandidateMetaRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function CandidateMetaRow({
  label,
  value,
  className,
}: CandidateMetaRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-2 text-sm border-b border-border/30 last:border-0",
        className
      )}
    >
      <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="font-medium text-foreground text-right">{value || "—"}</div>
    </div>
  );
}
