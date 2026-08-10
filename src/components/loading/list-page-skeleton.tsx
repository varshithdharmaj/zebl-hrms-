import { FiltersSkeleton } from "@/components/loading/filters-skeleton";
import { KpiGridSkeleton } from "@/components/loading/kpi-grid-skeleton";
import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton";
import { TableSkeleton } from "@/components/loading/table-skeleton";
import { cn } from "@/lib/utils";

type ListPageSkeletonProps = {
  label?: string;
  showKpis?: boolean;
  kpiCount?: number;
  filterFields?: number;
  tableRows?: number;
  tableColumns?: number;
  withHeaderAction?: boolean;
  className?: string;
};

export function ListPageSkeleton({
  label = "Loading page",
  showKpis = false,
  kpiCount = 4,
  filterFields = 4,
  tableRows = 6,
  tableColumns = 5,
  withHeaderAction = true,
  className,
}: ListPageSkeletonProps) {
  return (
    <div
      className={cn("space-y-6 lg:space-y-8", className)}
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <PageHeaderSkeleton withAction={withHeaderAction} />
      {showKpis && <KpiGridSkeleton count={kpiCount} />}
      <FiltersSkeleton fields={filterFields} />
      <TableSkeleton rows={tableRows} columns={tableColumns} />
    </div>
  );
}
