import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TableSkeletonProps = {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
};

export function TableSkeleton({
  rows = 6,
  columns = 5,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className
      )}
    >
      {showHeader && (
        <div className="flex items-center gap-4 border-b border-border bg-muted/80 px-4 py-3">
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton
              key={`h-${index}`}
              className={cn("h-4", index === 0 ? "w-8" : "w-20 flex-1 max-w-[8rem]")}
            />
          ))}
        </div>
      )}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`r-${rowIndex}`} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`c-${rowIndex}-${colIndex}`}
                className={cn(
                  "h-4",
                  colIndex === 0 ? "w-8" : "w-24 flex-1 max-w-[10rem]",
                  colIndex === columns - 1 && "max-w-[5rem]"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
