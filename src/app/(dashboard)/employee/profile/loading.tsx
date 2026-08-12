import { KpiGridSkeleton, PageHeaderSkeleton } from "@/components/loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeProfileLoading() {
  return (
    <div
      className="space-y-6 lg:space-y-8"
      aria-busy="true"
      aria-label="Loading profile"
      role="status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
        <PageHeaderSkeleton className="flex-1 border-0 bg-transparent p-0 shadow-none lg:p-0" />
      </div>
      <KpiGridSkeleton count={3} />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
