import { Suspense } from "react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { listRegularizationRequestsForReview } from "@/lib/attendance/regularization/regularization-service";
import { AttendanceRegularizationQueue } from "@/components/admin/attendance-regularization-queue";

type StatusFilter = "pending" | "approved" | "rejected" | "cancelled";

export default async function AdminAttendanceRegularizationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireHROrSuperAdminSession();
  const raw = await searchParams;
  const status: StatusFilter =
    raw.status === "approved" || raw.status === "rejected" || raw.status === "cancelled"
      ? raw.status
      : "pending";

  const requests = await listRegularizationRequestsForReview({ status });

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Attendance regularisation"
        description="Review employee-submitted corrections to derived attendance."
        backHref="/admin/attendance"
        backLabel="Attendance"
      />

      <Suspense fallback={<PageSkeleton />}>
        <AttendanceRegularizationQueue requests={requests} activeStatus={status} />
      </Suspense>
    </div>
  );
}
