import { KpiGridSkeleton, PageHeaderSkeleton } from "@/components/loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeDetailLoading() {
  return (
    <div
      className="space-y-6 lg:space-y-8"
      aria-busy="true"
      aria-label="Loading employee"
      role="status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
        <PageHeaderSkeleton className="flex-1" withAction />
      </div>
      <KpiGridSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
