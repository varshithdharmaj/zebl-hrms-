import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CandidateEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export function CandidateEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
}: CandidateEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-dashed border-border bg-muted/5 hover:bg-muted/10 transition-colors duration-200",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border mb-4 shadow-subtle">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && (
        <div>
          {onAction ? (
            <Button variant="outline" size="sm" onClick={onAction} className="shadow-subtle">
              {actionLabel}
            </Button>
          ) : actionHref ? (
            <Button variant="outline" size="sm" asChild className="shadow-subtle">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
