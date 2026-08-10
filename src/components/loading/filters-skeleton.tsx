import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FiltersSkeletonProps = {
  fields?: number;
  className?: string;
};

export function FiltersSkeleton({ fields = 4, className }: FiltersSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-xl border border-border bg-card p-4 shadow-subtle sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: fields }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
