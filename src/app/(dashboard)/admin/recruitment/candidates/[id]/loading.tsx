import { PageHeaderSkeleton } from "@/components/loading";
import { Skeleton } from "@/components/ui/skeleton";

/** Profile-shaped candidate detail fallback (header + tabs + cards, not a form). */
export default function CandidateDetailLoading() {
  return (
    <div
      className="space-y-6 lg:space-y-8"
      aria-busy="true"
      aria-label="Loading candidate"
      role="status"
    >
      <PageHeaderSkeleton withAction />

      <div className="border-b border-border">
        <div className="flex gap-6 pb-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-subtle">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-48" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-subtle">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-subtle">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-44" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-40 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
