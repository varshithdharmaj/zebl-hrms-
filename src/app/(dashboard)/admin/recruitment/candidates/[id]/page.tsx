import Link from "next/link";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { canAccessHRAdministration } from "@/lib/permissions";
import { getCandidateCached, getEmployeeOptions } from "@/lib/recruitment/candidate";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import { listApplicationsCached } from "@/lib/recruitment/application/queries";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { CandidateDetailView } from "@/components/recruitment/candidates/candidate-detail";
import { CandidateErrorView } from "@/components/recruitment/candidates/candidate-error-view";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import {
  parseRecruitmentNavSearch,
  resolveRecruitmentReturnTo,
  returnToLabel,
} from "@/lib/recruitment/navigation/return-to";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { AiInsightType } from "@/generated/prisma/enums";
import { createCandidateAiEnrichmentService, isEnrichmentFresh } from "@/lib/recruitment/services/candidate-ai-enrichment-service";
import {
  createCandidateAiRecoveryService,
  isRecoveryFresh,
} from "@/lib/recruitment/services/candidate-ai-recovery-service";
import { parseResumeImportDraftContent } from "@/lib/recruitment/resume-import/draft-content";

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionOrThrow();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const nav = parseRecruitmentNavSearch(query);
  const canManageCandidate = canAccessHRAdministration(session.role);
  const notice = typeof query.notice === "string" ? query.notice : undefined;
  const bannerNotice =
    notice === "resume-attach-failed"
      ? "Candidate created, but the resume could not be attached. Upload the resume again from the Documents tab."
      : null;
  const backHref = resolveRecruitmentReturnTo(nav.returnTo, "/admin/recruitment/candidates");
  const backLabel = returnToLabel(nav.returnTo, "Back to candidates");

  let candidate;
  try {
    candidate = await getCandidateCached(session, id);
  } catch (error) {
    if (isRecruitmentDomainError(error)) {
      if (error.code === "REC_NOT_FOUND") {
        return (
          <div className="space-y-6 lg:space-y-8">
            <WorkspacePageHeader
              title="Candidate Not Found"
              description="The requested candidate profile could not be located."
              backHref="/admin/recruitment/candidates"
              backLabel="Back to candidates"
            />
            <CandidateErrorView type="not_found" />
          </div>
        );
      }
      if (error.code === "REC_UNAUTHORIZED" || error.code === "REC_FORBIDDEN_SCOPE") {
        return (
          <div className="space-y-6 lg:space-y-8">
            <WorkspacePageHeader
              title="Access Denied"
              description="You do not have permissions to view this candidate profile."
              backHref="/admin/recruitment/candidates"
              backLabel="Back to candidates"
            />
            <CandidateErrorView type="permission_denied" />
          </div>
        );
      }
    }
    return (
      <div className="space-y-6 lg:space-y-8">
        <WorkspacePageHeader
          title="Error"
          description="An unexpected error occurred."
          backHref="/admin/recruitment/candidates"
          backLabel="Back to candidates"
        />
        <CandidateErrorView
          type="unexpected"
          message={error instanceof Error ? error.message : "Something went wrong."}
        />
      </div>
    );
  }

  const enrichmentService = createCandidateAiEnrichmentService();
  const recoveryService = createCandidateAiRecoveryService();

  const [
    timeline,
    employees,
    interviewsResult,
    offers,
    applicationsResult,
    canWriteDiscussion,
    enrichment,
    recovery,
    resumeDrafts,
  ] = await Promise.all([
      RecruitmentTimelineService.buildTimeline({
        candidateId: candidate.id,
        limit: 50,
      }),
      getEmployeeOptions(),
      listInterviewsCached(
        session,
        { candidateId: candidate.id },
        { page: 1, pageSize: 50 }
      ),
      prisma.offer.findMany({
        where: {
          application: {
            candidateId: candidate.id,
          },
        },
        include: {
          application: {
            include: {
              jobOpening: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      listApplicationsCached(
        session,
        { candidateId: candidate.id },
        { page: 1, pageSize: 50 },
        { field: "createdAt", direction: "desc" }
      ),
      RecruitmentPermissionService.canWriteCandidateDiscussion(session, candidate.id),
      enrichmentService.listLatestEnrichment(candidate.id),
      recoveryService.listLatestRecovery(candidate.id),
      prisma.candidateAiInsight.findMany({
        where: {
          candidateId: candidate.id,
          insightType: AiInsightType.resume_parse,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, contentJson: true },
      }),
    ]);

  const sourceDraftId =
    enrichment.content?.sourceDraftId ??
    recovery.content?.sourceDraftId ??
    resumeDrafts.find((row) => {
      try {
        parseResumeImportDraftContent(row.contentJson);
        return true;
      } catch {
        return false;
      }
    })?.id ??
    null;

  let enrichmentMapped = null;
  if (enrichment.content?.sourceDraftId) {
    const draftRow =
      resumeDrafts.find((row) => row.id === enrichment.content?.sourceDraftId) ??
      (await prisma.candidateAiInsight.findUnique({
        where: { id: enrichment.content.sourceDraftId },
        select: { id: true, contentJson: true, candidateId: true },
      }));
    if (draftRow && (!("candidateId" in draftRow) || draftRow.candidateId === candidate.id)) {
      try {
        enrichmentMapped = parseResumeImportDraftContent(draftRow.contentJson).mapped;
      } catch {
        enrichmentMapped = null;
      }
    }
  }

  const enrichmentIsStale =
    enrichment.content != null &&
    String(enrichment.insight?.status ?? "") === "pending_review" &&
    !isEnrichmentFresh({
      content: enrichment.content,
      candidate,
      mapped: enrichmentMapped,
    });

  const recoveryIsStale =
    recovery.content != null &&
    String(recovery.insight?.status ?? "") === "pending_review" &&
    !isRecoveryFresh({
      content: recovery.content,
      candidate,
      resumeTextHash: recovery.content.resumeTextHash,
    });

  const interviews = interviewsResult.items;
  const applications = applicationsResult.items.map((item) => ({
    id: String(item.id),
    status: String(item.status ?? ""),
    currentStage: String(item.currentStage ?? ""),
    jobOpeningId: String(
      item.jobOpeningId ??
        (item as { jobOpening?: { id?: string } }).jobOpening?.id ??
        ""
    ),
    jobTitle: String(
      (item as { jobOpening?: { title?: string } }).jobOpening?.title ?? "Job"
    ),
    createdAt: item.createdAt as Date | string,
  }));

  const originatingApp = nav.applicationId
    ? applications.find((app) => app.id === nav.applicationId)
    : undefined;

  return (
    <div className="space-y-6 lg:space-y-8">
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "candidates",
          candidate: { id: candidate.id, name: candidate.fullName },
          job:
            originatingApp && originatingApp.jobOpeningId
              ? { id: originatingApp.jobOpeningId, title: originatingApp.jobTitle }
              : null,
          application: originatingApp
            ? { id: originatingApp.id, jobTitle: originatingApp.jobTitle }
            : null,
          returnTo: nav.returnTo,
        })}
        stage={originatingApp?.currentStage ?? nav.currentStage}
        status={originatingApp?.status}
      />
      <WorkspacePageHeader
        leading={
          <ProfileAvatar
            alt={`${candidate.fullName} profile photo`}
            editable={canManageCandidate}
            size="lg"
          />
        }
        title={candidate.fullName}
        description={
          candidate.currentTitle && candidate.currentCompany
            ? `${candidate.currentTitle} at ${candidate.currentCompany}`
            : "Candidate workspace — profile, applications, docs, and discussion."
        }
        backHref={backHref}
        backLabel={backLabel}
        action={
          canManageCandidate ? (
            <Button asChild className="shadow-subtle font-semibold">
              <Link href={`/admin/recruitment/candidates/${candidate.id}/edit`}>Edit</Link>
            </Button>
          ) : undefined
        }
      />

      <CandidateDetailView
        candidate={candidate}
        timeline={timeline}
        employeeOptions={employees}
        applications={applications}
        interviews={interviews.map((item) => ({
          id: String(item.id),
          title: String(item.title ?? "Interview"),
          scheduledStart: item.scheduledStart as Date | string,
          roundType: String(item.roundType ?? "round"),
          status: String(item.status ?? "scheduled"),
        }))}
        offers={offers.map((item) => ({
          id: item.id,
          offerNumber: item.offerNumber,
          ctc: item.ctc == null ? null : Number(item.ctc),
          currency: item.currency,
          status: item.status,
          application: item.application
            ? {
                jobOpening: item.application.jobOpening
                  ? { title: item.application.jobOpening.title }
                  : null,
              }
            : null,
        }))}
        canWriteDiscussion={canWriteDiscussion}
        canManageCandidate={canManageCandidate}
        aiEnrichment={{
          insightId: enrichment.insight ? String(enrichment.insight.id) : null,
          status: enrichment.insight ? String(enrichment.insight.status) : null,
          content: enrichment.content,
          sourceDraftId,
          isStale: enrichmentIsStale,
        }}
        aiRecovery={{
          insightId: recovery.insight ? String(recovery.insight.id) : null,
          status: recovery.insight ? String(recovery.insight.status) : null,
          content: recovery.content,
          sourceDraftId: recovery.content?.sourceDraftId ?? sourceDraftId,
          isStale: recoveryIsStale,
        }}
        bannerNotice={bannerNotice}
        navContext={{
          returnTo: nav.returnTo,
          originatingApplicationId: nav.applicationId,
          jobOpeningId: nav.jobOpeningId,
          currentStage: nav.currentStage,
        }}
      />
    </div>
  );
}
