import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ApplicationForm } from "@/components/recruitment/applications/application-form";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { prisma } from "@/lib/prisma";

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireHROrSuperAdminSession();
  const raw = await searchParams;
  const preselectedCandidateId = typeof raw.candidateId === "string" ? raw.candidateId : undefined;

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
        title="New Application"
        description="Link a candidate profile to an active job opening to begin their recruitment process."
      />

      <ApplicationForm
        mode="create"
        candidates={candidates}
        jobs={jobs}
        employees={employees}
        preselectedCandidateId={preselectedCandidateId}
      />
    </div>
  );
}
