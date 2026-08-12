import { FormPageSkeleton, PageHeaderSkeleton } from "@/components/loading";
import { Skeleton } from "@/components/ui/skeleton";

/** Profile-shaped candidate detail fallback (header + cards, not a list table). */
export default function CandidateDetailLoading() {
  return (
    <div
      className="space-y-6 lg:space-y-8"
      aria-busy="true"
      aria-label="Loading candidate"
      role="status"
    >
      <PageHeaderSkeleton withAction />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl lg:col-span-2" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <FormPageSkeleton label="Loading candidate details" />
    </div>
  );
}
