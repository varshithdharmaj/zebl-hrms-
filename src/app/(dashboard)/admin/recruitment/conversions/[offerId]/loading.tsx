import { FormPageSkeleton, PageHeaderSkeleton } from "@/components/loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConversionDetailLoading() {
  return (
    <div
      className="space-y-6 lg:space-y-8"
      aria-busy="true"
      aria-label="Loading conversion"
      role="status"
    >
      <PageHeaderSkeleton withAction />
      <Skeleton className="h-40 w-full rounded-xl" />
      <FormPageSkeleton label="Loading conversion preview" />
    </div>
  );
}
