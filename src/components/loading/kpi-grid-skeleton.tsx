import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type KpiGridSkeletonProps = {
  count?: number;
  className?: string;
};

export function KpiGridSkeleton({ count = 4, className }: KpiGridSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        count >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-[7.5rem] rounded-2xl" />
      ))}
    </div>
  );
}
