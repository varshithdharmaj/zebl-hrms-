import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FormPageSkeletonProps = {
  label?: string;
  className?: string;
};

export function FormPageSkeleton({
  label = "Loading form",
  className,
}: FormPageSkeletonProps) {
  return (
    <div
      className={cn("space-y-6 lg:space-y-8", className)}
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <PageHeaderSkeleton />
      <div className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6 shadow-subtle">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  );
}
