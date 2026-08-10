import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { RecruitmentBreadcrumb } from "@/lib/recruitment/navigation/breadcrumbs";
import { formatRecruitmentEnumLabel } from "@/lib/recruitment/navigation/breadcrumbs";

export function RecruitmentContextHeader({
  crumbs,
  stage,
  status,
}: {
  crumbs: readonly RecruitmentBreadcrumb[];
  stage?: string | null;
  status?: string | null;
}) {
  if (crumbs.length === 0) return null;

  const stageLabel = formatRecruitmentEnumLabel(stage ?? undefined);
  const statusLabel = formatRecruitmentEnumLabel(status ?? undefined);

  return (
    <div className="space-y-2">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
                {index > 0 ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : null}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="truncate font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className="truncate font-semibold text-foreground"
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {stageLabel || statusLabel ? (
        <p className="text-xs font-medium text-muted-foreground">
          {stageLabel ? `Stage: ${stageLabel}` : null}
          {stageLabel && statusLabel ? " · " : null}
          {statusLabel ? `Status: ${statusLabel}` : null}
        </p>
      ) : null}
    </div>
  );
}
