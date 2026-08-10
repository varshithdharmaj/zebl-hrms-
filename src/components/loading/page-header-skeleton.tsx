import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageHeaderSkeletonProps = {
  withAction?: boolean;
  className?: string;
};

export function PageHeaderSkeleton({
  withAction = false,
  className,
}: PageHeaderSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-subtle lg:p-7",
        className
      )}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 sm:w-64" />
          <Skeleton className="h-4 w-72 max-w-full sm:w-96" />
        </div>
        {withAction && <Skeleton className="h-10 w-32 shrink-0" />}
      </div>
    </div>
  );
}
