import { FiltersSkeleton, KpiGridSkeleton, PageHeaderSkeleton } from "@/components/loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading pipeline"
      role="status"
    >
      <PageHeaderSkeleton withAction />
      <FiltersSkeleton fields={3} />
      <KpiGridSkeleton count={4} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-subtle"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
