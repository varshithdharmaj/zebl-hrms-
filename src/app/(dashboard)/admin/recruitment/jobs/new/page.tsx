import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { JobOpeningForm } from "@/components/recruitment/jobs/job-opening-form";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import {
  listActivePipelineTemplatesCached,
  listEmployeeOptionsCached,
} from "@/lib/recruitment/job/queries";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";

export default async function NewJobOpeningPage() {
  const session = await requireRecruitmentAdminSession();
  const [employees, templates] = await Promise.all([
    listEmployeeOptionsCached(),
    listActivePipelineTemplatesCached(),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Create job opening"
        description="Define the role, hiring team, headcount, and pipeline."
        backHref="/admin/recruitment/jobs"
        backLabel="Back to jobs"
      />
      <JobOpeningForm
        mode="create"
        employees={employees}
        templates={templates}
        showCompensation={RecruitmentPermissionService.canEditJobCompensation(session)}
        currentUserId={session.id}
      />
    </div>
  );
}
