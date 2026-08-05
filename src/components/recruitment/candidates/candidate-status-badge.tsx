import type { CandidateStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { CANDIDATE_STATUS_LABELS } from "@/lib/recruitment/candidate/labels";

const STYLES: Record<CandidateStatus, string> = {
  active: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
  hired: "bg-sky-50 text-sky-800 ring-1 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20",
  talent_pool: "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20",
  do_not_hire: "bg-rose-50 text-rose-800 ring-1 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
  archived: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/20",
  merged: "bg-purple-50 text-purple-800 ring-1 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20",
};

export function CandidateStatusBadge({
  status,
  className,
}: {
  status: CandidateStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tracking-tight",
        STYLES[status],
        className
      )}
    >
      {CANDIDATE_STATUS_LABELS[status]}
    </span>
  );
}
