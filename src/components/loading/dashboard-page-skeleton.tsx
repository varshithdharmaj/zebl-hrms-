import { KpiGridSkeleton } from "@/components/loading/kpi-grid-skeleton";
import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton";
import { TableSkeleton } from "@/components/loading/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DashboardPageSkeletonProps = {
  label?: string;
  kpiCount?: number;
  showTable?: boolean;
  className?: string;
};

export function DashboardPageSkeleton({
  label = "Loading dashboard",
  kpiCount = 4,
  showTable = true,
  className,
}: DashboardPageSkeletonProps) {
  return (
    <div
      className={cn("space-y-6 lg:space-y-8", className)}
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <PageHeaderSkeleton />
      <KpiGridSkeleton count={kpiCount} />
      <Skeleton className="h-80 w-full rounded-2xl" />
      {showTable && <TableSkeleton rows={5} columns={4} />}
    </div>
  );
}
