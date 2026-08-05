import type { CandidateSource } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { CANDIDATE_SOURCE_LABELS } from "@/lib/recruitment/candidate/labels";

export function CandidateSourceBadge({
  source,
  className,
}: {
  source: CandidateSource;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-500/10 dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/20",
        className
      )}
    >
      {CANDIDATE_SOURCE_LABELS[source] || source}
    </span>
  );
}
