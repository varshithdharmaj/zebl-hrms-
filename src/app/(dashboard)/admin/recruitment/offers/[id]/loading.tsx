import { FormPageSkeleton, PageHeaderSkeleton } from "@/components/loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function OfferDetailLoading() {
  return (
    <div
      className="space-y-6 lg:space-y-8"
      aria-busy="true"
      aria-label="Loading offer"
      role="status"
    >
      <PageHeaderSkeleton withAction />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <FormPageSkeleton label="Loading offer details" />
    </div>
  );
}
