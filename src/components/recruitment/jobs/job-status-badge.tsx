import type { JobOpeningStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { JOB_STATUS_LABELS } from "@/lib/recruitment/job/labels";

const STYLES: Record<JobOpeningStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  open: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20",
  on_hold: "bg-amber-50 text-amber-900 ring-1 ring-amber-600/20",
  closed: "bg-rose-50 text-rose-800 ring-1 ring-rose-600/20",
  filled: "bg-sky-50 text-sky-800 ring-1 ring-sky-600/20",
};

export function JobStatusBadge({
  status,
  className,
}: {
  status: JobOpeningStatus;
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
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
