import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ApplicationDetailView } from "@/components/recruitment/applications/application-detail";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { getApplicationCached } from "@/lib/recruitment/application";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import { prismaOfferRepository } from "@/lib/recruitment/repositories/prisma-offer-repository";
import {
  getCurrentHiringDecisionCached,
  getRequireDecisionForOfferCached,
} from "@/lib/recruitment/decision/queries";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import {
  buildPipelineHref,
  buildRecruitmentEntityHref,
  parseRecruitmentNavSearch,
  resolveRecruitmentReturnTo,
  returnToLabel,
} from "@/lib/recruitment/navigation/return-to";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit } from "lucide-react";

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRecruitmentAdminSession();
  const { id } = await params;
  const nav = parseRecruitmentNavSearch((await searchParams) ?? {});

  const app = await getApplicationCached(session, id);
  if (!app) {
    notFound();
  }

  const employeeOptions = await getEmployeeOptions();

  const interviewsResult = await listInterviewsCached(
    session,
    { applicationId: id },
    { page: 1, pageSize: 100 }
  );
  const interviews = interviewsResult.items;

  const [offers, currentDecision, requireDecisionForOffer] = await Promise.all([
    prismaOfferRepository.listByApplication(id),
    getCurrentHiringDecisionCached(session, id),
    getRequireDecisionForOfferCached(),
  ]);

  const candidateId = app.candidate?.id;
  const jobId = app.jobOpening?.id;
  const jobTitle = app.jobOpening?.title ?? "Role";
  const candidateName = app.candidate?.fullName ?? "Candidate";
  const pipelineHref = resolveRecruitmentReturnTo(
    nav.returnTo,
    buildPipelineHref({
      applicationId: app.id,
      jobOpeningId: jobId,
      currentStage: app.currentStage,
    })
  );
  const candidateHref = candidateId
    ? buildRecruitmentEntityHref(`/admin/recruitment/candidates/${candidateId}`, {
        returnTo: `/admin/recruitment/applications/${app.id}`,
        applicationId: app.id,
        jobOpeningId: jobId,
        currentStage: app.currentStage,
      })
    : "/admin/recruitment/candidates";
  const jobHref = jobId
    ? `/admin/recruitment/jobs/${jobId}`
    : "/admin/recruitment/jobs";

  return (
    <div className="space-y-6 lg:space-y-8">
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "applications",
          returnTo: nav.returnTo,
          candidate: candidateId ? { id: candidateId, name: candidateName } : null,
          job: jobId ? { id: jobId, title: jobTitle } : null,
          application: { id: app.id, jobTitle },
        })}
        stage={app.currentStage}
        status={app.status}
      />
      <WorkspacePageHeader
        title={`${candidateName}'s Application`}
        description={`Track progress for ${candidateName} applying for ${jobTitle}.`}
        backHref={pipelineHref}
        backLabel={returnToLabel(nav.returnTo, "Back to pipeline")}
        action={
          <Button asChild variant="outline" className="font-semibold shadow-subtle flex items-center gap-1.5">
            <Link href={`/admin/recruitment/applications/${app.id}/edit`}>
              <Edit className="h-4 w-4 text-muted-foreground" />
              Edit Application
            </Link>
          </Button>
        }
      />

      <ApplicationDetailView
        application={app}
        employeeOptions={employeeOptions}
        interviews={interviews}
        offers={offers}
        currentDecision={currentDecision}
        requireDecisionForOffer={requireDecisionForOffer}
        navigation={{
          candidateHref,
          jobHref,
          pipelineHref,
        }}
      />
    </div>
  );
}
