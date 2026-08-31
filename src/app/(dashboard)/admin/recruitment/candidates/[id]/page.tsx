import Link from "next/link";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { canAccessHRAdministration, PermissionError } from "@/lib/permissions";
import {
  getCandidateOverviewCached,
  getCandidateTimelineCached,
  getResumeParseDraftCached,
  listCandidateDocumentsCached,
  listResumeParseDraftsCached,
} from "@/lib/recruitment/candidate";
import { parseCandidateWorkspaceTab } from "@/lib/recruitment/candidate/workspace-tab";
import {
  mapWorkspaceApplicationRow,
  type CandidateWorkspaceApplicationRow,
} from "@/lib/recruitment/candidate/workspace-applications";
import {
  redactCandidateCompensationFields,
  redactOfferCtc,
} from "@/lib/recruitment/candidate/workspace-compensation";
import {
  mapWorkspaceInterviewRow,
  type CandidateWorkspaceInterviewRow,
} from "@/lib/recruitment/candidate/workspace-interviews";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import {
  countCandidateApplicationsCached,
  getApplicationCached,
  listApplicationsCached,
} from "@/lib/recruitment/application/queries";
import { listOffersCached } from "@/lib/recruitment/offer/queries";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
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
import { CandidatePhotoAvatar } from "@/components/recruitment/candidates/candidate-photo-avatar";
import { Button } from "@/components/ui/button";
import { createCandidateAiEnrichmentService, isEnrichmentFresh } from "@/lib/recruitment/services/candidate-ai-enrichment-service";
import {
  createCandidateAiRecoveryService,
  isRecoveryFresh,
} from "@/lib/recruitment/services/candidate-ai-recovery-service";
import { parseResumeImportDraftContent } from "@/lib/recruitment/resume-import/draft-content";
import type { TimelineItem } from "@/lib/recruitment/types/timeline";
import type { CandidateDocumentView } from "@/lib/recruitment/candidate/types";
import type { OfferDetail } from "@/lib/recruitment/repositories/offer-repository";

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
  const tab = parseCandidateWorkspaceTab(query);
  const nav = parseRecruitmentNavSearch(query);
  const canManageCandidate = canAccessHRAdministration(session.role);
  const notice = typeof query.notice === "string" ? query.notice : undefined;
  const bannerNotice =
    notice === "resume-attach-failed"
      ? "Candidate created, but the resume could not be attached. Upload the resume again from the Documents tab."
      : null;
  const backHref = resolveRecruitmentReturnTo(nav.returnTo, "/admin/recruitment/candidates");
  const backLabel = returnToLabel(nav.returnTo, "Back to candidates");

  let candidateOverview;
  try {
    candidateOverview = await getCandidateOverviewCached(session, id);
  } catch (error) {
    if (error instanceof PermissionError) {
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

  const candidateId = candidateOverview.id;
  const enrichmentService = createCandidateAiEnrichmentService();
  const recoveryService = createCandidateAiRecoveryService();

  const recruitmentScope = await RecruitmentScopeEngine.getScope(session);
  const canViewCompensation = RecruitmentPermissionService.canViewCompensation(
    session,
    recruitmentScope.capabilities.isHiringManager
  );

  let applications: CandidateWorkspaceApplicationRow[] = [];
  let applicationCount = 0;

  if (tab === "overview" || tab === "applications") {
    const applicationsResult = await listApplicationsCached(
      session,
      { candidateId },
      { page: 1, pageSize: 50 },
      { field: "createdAt", direction: "desc" }
    );
    applications = applicationsResult.items.map((item) => mapWorkspaceApplicationRow(item));
    applicationCount = applications.length;
  } else {
    applicationCount = await countCandidateApplicationsCached(session, candidateId);
    if (nav.applicationId) {
      try {
        const app = await getApplicationCached(session, nav.applicationId);
        if (app && String(app.candidateId) === candidateId) {
          applications = [mapWorkspaceApplicationRow(app)];
        }
      } catch {
        // Out-of-scope or missing application — breadcrumb context omitted.
      }
    }
  }

  let timeline: readonly TimelineItem[] = [];
  let documents: CandidateDocumentView[] = [];
  let interviews: CandidateWorkspaceInterviewRow[] = [];
  let offers: OfferDetail[] = [];
  let canWriteDiscussion = false;
  let enrichment: Awaited<ReturnType<typeof enrichmentService.listLatestEnrichment>> = {
    insight: null,
    content: null,
  };
  let recovery: Awaited<ReturnType<typeof recoveryService.listLatestRecovery>> = {
    insight: null,
    content: null,
  };
  let resumeDrafts: Array<{ id: string; contentJson: unknown }> = [];

  if (tab === "overview") {
    [canWriteDiscussion, enrichment, recovery, resumeDrafts] = await Promise.all([
      RecruitmentPermissionService.canWriteCandidateDiscussion(session, candidateId),
      enrichmentService.listLatestEnrichment(candidateId),
      recoveryService.listLatestRecovery(candidateId),
      listResumeParseDraftsCached(session, candidateId, 5),
    ]);
  } else if (tab === "applications") {
    const [interviewsResult, offersResult] = await Promise.all([
      listInterviewsCached(session, { candidateId }, { page: 1, pageSize: 50 }),
      listOffersCached(
        session,
        { candidateId },
        { page: 1, pageSize: 50 },
        { field: "createdAt", direction: "desc" }
      ),
    ]);
    interviews = interviewsResult.items.map((item) => mapWorkspaceInterviewRow(item));
    offers = offersResult.items;
  } else if (tab === "documents") {
    documents = await listCandidateDocumentsCached(session, candidateId);
  } else if (tab === "activity") {
    timeline = await getCandidateTimelineCached(session, candidateId, 50);
  }

  const candidate = redactCandidateCompensationFields(
    {
      ...candidateOverview,
      documents,
    },
    canViewCompensation
  );

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

  /** When overview has a resume file but no parse draft, Generate can create one. */
  let resumeDocumentId: string | null = null;
  if (tab === "overview" && !sourceDraftId) {
    const docs = await listCandidateDocumentsCached(session, candidateId);
    resumeDocumentId =
      docs.find((d) => d.documentType === "resume" && d.isPrimary)?.id ??
      docs.find((d) => d.documentType === "resume")?.id ??
      null;
  }

  let enrichmentMapped = null;
  if (enrichment.content?.sourceDraftId) {
    const draftRow =
      resumeDrafts.find((row) => row.id === enrichment.content?.sourceDraftId) ??
      (await getResumeParseDraftCached(
        session,
        candidateId,
        enrichment.content.sourceDraftId
      ));
    if (draftRow) {
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

  const originatingApp = nav.applicationId
    ? applications.find((app) => app.id === nav.applicationId)
    : undefined;

  // React.cache dedupes this against the tab === "documents" / resume-lookup
  // calls above within the same request — cheap even when already fetched.
  const allDocuments =
    tab === "documents" ? documents : await listCandidateDocumentsCached(session, candidateId);
  const photoDocumentId =
    allDocuments.find((d) => d.documentType === "photo" && !d.deletedAt)?.id ?? null;

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
        stage={originatingApp?.currentStage}
        status={originatingApp?.status}
      />
      <WorkspacePageHeader
        leading={
          <CandidatePhotoAvatar
            candidateId={candidate.id}
            fullName={candidate.fullName}
            photoDocumentId={photoDocumentId}
            editable={canManageCandidate}
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
        initialTab={tab}
        timeline={timeline}
        applications={applications}
        applicationCount={applicationCount}
        interviews={interviews}
        offers={offers.map((item) => ({
          id: item.id,
          offerNumber: item.offerNumber,
          ctc: redactOfferCtc(item.ctc, canViewCompensation),
          currency: canViewCompensation ? item.currency : null,
          status: item.status,
          applicationId: item.applicationId ? String(item.applicationId) : null,
          application: item.application
            ? {
                id: item.application.id ? String(item.application.id) : null,
                jobOpening: item.application.jobOpening
                  ? { title: item.application.jobOpening.title }
                  : null,
              }
            : null,
        }))}
        canWriteDiscussion={canWriteDiscussion}
        canManageCandidate={canManageCandidate}
        canViewCompensation={canViewCompensation}
        aiEnrichment={{
          insightId: enrichment.insight ? String(enrichment.insight.id) : null,
          status: enrichment.insight ? String(enrichment.insight.status) : null,
          content: enrichment.content,
          sourceDraftId,
          resumeDocumentId,
          isStale: enrichmentIsStale,
        }}
        aiRecovery={{
          insightId: recovery.insight ? String(recovery.insight.id) : null,
          status: recovery.insight ? String(recovery.insight.status) : null,
          content: recovery.content,
          sourceDraftId: recovery.content?.sourceDraftId ?? sourceDraftId,
          resumeDocumentId,
          isStale: recoveryIsStale,
        }}
        bannerNotice={bannerNotice}
        navContext={{
          returnTo: nav.returnTo,
          originatingApplicationId: originatingApp?.id ?? null,
          jobOpeningId: originatingApp?.jobOpeningId ?? null,
          currentStage: originatingApp?.currentStage ?? null,
        }}
      />
    </div>
  );
}
