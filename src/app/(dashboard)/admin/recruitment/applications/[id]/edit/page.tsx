import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ApplicationForm } from "@/components/recruitment/applications/application-form";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { getApplicationCached } from "@/lib/recruitment/application";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { prisma } from "@/lib/prisma";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRecruitmentAdminSession();
  const { id } = await params;

  const app = await getApplicationCached(session, id);
  if (!app) {
    notFound();
  }

  // Fetch candidates
  const candidates = await prisma.candidate.findMany({
    where: { deletedAt: null },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  // Fetch job openings
  const jobs = await prisma.jobOpening.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  const employees = await getEmployeeOptions();

  const candidateName = app.candidate?.fullName ?? "Candidate";
  const jobTitle = app.jobOpening?.title ?? "Role";

  return (
    <div className="space-y-6 lg:space-y-8">
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "applications",
          candidate: app.candidate
            ? { id: app.candidate.id, name: candidateName }
            : null,
          job: app.jobOpening ? { id: app.jobOpening.id, title: jobTitle } : null,
          application: { id: app.id, jobTitle },
          leafLabel: "Edit",
        })}
        stage={app.currentStage}
        status={app.status}
      />
      <WorkspacePageHeader
        title="Edit Application"
        description={`Update details for ${candidateName}'s application.`}
        backHref={`/admin/recruitment/applications/${app.id}`}
        backLabel="Back to application"
      />

      <ApplicationForm
        mode="edit"
        application={app}
        candidates={candidates}
        jobs={jobs}
        employees={employees}
      />
    </div>
  );
}
