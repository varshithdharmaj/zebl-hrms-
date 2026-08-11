import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { JobOpeningForm } from "@/components/recruitment/jobs/job-opening-form";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import {
  getJobOpeningCached,
  listActivePipelineTemplatesCached,
  listEmployeeOptionsCached,
} from "@/lib/recruitment/job/queries";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";

export default async function EditJobOpeningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRecruitmentAdminSession();
  const { id } = await params;

  let job;
  try {
    job = await getJobOpeningCached(session, id);
  } catch (error) {
    if (isRecruitmentDomainError(error) && error.code === "REC_NOT_FOUND") notFound();
    throw error;
  }

  const [employees, templates] = await Promise.all([
    listEmployeeOptionsCached(),
    listActivePipelineTemplatesCached(),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={`Edit ${job.title}`}
        description="Update allowed job fields. Pipeline stages remain frozen."
        backHref={`/admin/recruitment/jobs/${job.id}`}
        backLabel="Back to job"
      />
      <JobOpeningForm
        mode="edit"
        job={job}
        employees={employees}
        templates={templates}
        showCompensation={RecruitmentPermissionService.canEditJobCompensation(session)}
        currentUserId={session.id}
      />
    </div>
  );
}
