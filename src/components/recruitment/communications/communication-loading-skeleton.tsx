import { Skeleton } from "@/components/ui/skeleton";

export function CommunicationLoadingSkeleton() {
  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
      aria-busy="true"
      aria-label="Loading communications"
    >
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-subtle">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-3/4" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-2 rounded-lg border border-border/60 p-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-subtle">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <div className="space-y-3 pt-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
