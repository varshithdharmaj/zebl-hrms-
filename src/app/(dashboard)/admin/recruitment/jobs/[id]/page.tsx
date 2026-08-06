import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { JobOpeningDetailView } from "@/components/recruitment/jobs/job-opening-detail";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { getJobOpeningCached } from "@/lib/recruitment/job/queries";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";

export default async function JobOpeningDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireHROrSuperAdminSession();
  const { id } = await params;

  let job;
  try {
    job = await getJobOpeningCached(session, id);
  } catch (error) {
    if (isRecruitmentDomainError(error) && error.code === "REC_NOT_FOUND") notFound();
    throw error;
  }

  const timeline = await RecruitmentTimelineService.buildTimeline({
    jobOpeningId: job.id,
    limit: 50,
  });
  const showCompensation = RecruitmentPermissionService.canViewJobCompensation(session);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={job.title}
        description="Job opening detail, hiring team, timeline, and operations."
        backHref="/admin/recruitment/jobs"
        backLabel="Back to jobs"
        action={
          <Button asChild>
            <Link href={`/admin/recruitment/jobs/${job.id}/edit`}>Edit</Link>
          </Button>
        }
      />
      <JobOpeningDetailView
        job={job}
        timeline={timeline}
        showCompensation={showCompensation}
      />
    </div>
  );
}
