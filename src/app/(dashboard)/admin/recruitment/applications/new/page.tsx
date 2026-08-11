import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ApplicationForm } from "@/components/recruitment/applications/application-form";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { prisma } from "@/lib/prisma";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import {
  parseRecruitmentNavSearch,
  resolveRecruitmentReturnTo,
  returnToLabel,
} from "@/lib/recruitment/navigation/return-to";

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRecruitmentAdminSession();
  const raw = await searchParams;
  const nav = parseRecruitmentNavSearch(raw);
  const preselectedCandidateId = typeof raw.candidateId === "string" ? raw.candidateId : undefined;
  const backHref = resolveRecruitmentReturnTo(
    nav.returnTo,
    preselectedCandidateId
      ? `/admin/recruitment/candidates/${preselectedCandidateId}`
      : "/admin/recruitment/pipeline"
  );

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
  const preselectedName = preselectedCandidateId
    ? candidates.find((c) => c.id === preselectedCandidateId)?.fullName
    : undefined;

  return (
    <div className="space-y-6 lg:space-y-8">
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "applications",
          candidate:
            preselectedCandidateId && preselectedName
              ? { id: preselectedCandidateId, name: preselectedName }
              : null,
          leafLabel: "New Application",
          returnTo: nav.returnTo,
        })}
      />
      <WorkspacePageHeader
        title="New Application"
        description="Link a candidate profile to an active job opening to begin their recruitment process."
        backHref={backHref}
        backLabel={returnToLabel(nav.returnTo, preselectedCandidateId ? "Back to candidate" : "Back to pipeline")}
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
