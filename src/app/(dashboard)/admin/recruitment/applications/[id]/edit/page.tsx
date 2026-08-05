import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ApplicationForm } from "@/components/recruitment/applications/application-form";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { getApplicationCached } from "@/lib/recruitment/application";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { prisma } from "@/lib/prisma";

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireHROrSuperAdminSession();
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

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Edit Application"
        description={`Update details for ${app.candidate.fullName}'s application.`}
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
