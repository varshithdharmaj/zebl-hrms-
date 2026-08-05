import React from "react";
import { SectionCard } from "@/components/ui/section-card";
import { cn } from "@/lib/utils";

export interface CandidateSectionProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function CandidateSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: CandidateSectionProps) {
  return (
    <SectionCard
      title={title}
      description={description}
      action={action}
      className={cn(
        "transition-all duration-200 hover:shadow-md border-border/80",
        className
      )}
      contentClassName={cn("p-6 sm:p-7 space-y-4", contentClassName)}
    >
      {children}
    </SectionCard>
  );
}
