import Link from "next/link";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { canAccessHRAdministration } from "@/lib/permissions";
import { getCandidateCached, getEmployeeOptions } from "@/lib/recruitment/candidate";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import { listCommunicationsCached } from "@/lib/recruitment/communication";
import { listApplicationsCached } from "@/lib/recruitment/application/queries";
import { mergeCandidateRecruitmentTimeline } from "@/lib/recruitment/communication/candidate-timeline";
import { toCommunicationThreadMessageView } from "@/components/recruitment/communications/mappers";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { CandidateDetailView } from "@/components/recruitment/candidates/candidate-detail";
import { CandidateErrorView } from "@/components/recruitment/candidates/candidate-error-view";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireHROrSuperAdminSession();
  const { id } = await params;

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

  const [timeline, employees, interviewsResult, offers, communicationsResult, scope, applicationsResult] =
    await Promise.all([
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
      listCommunicationsCached(session, {
        candidateId: candidate.id,
        page: 1,
        pageSize: 50,
      }),
      RecruitmentScopeEngine.getScope(session),
      listApplicationsCached(
        session,
        { candidateId: candidate.id },
        { page: 1, pageSize: 50 },
        { field: "createdAt", direction: "desc" }
      ),
    ]);

  const interviews = interviewsResult.items;
  const applications = applicationsResult.items.map((item) => ({
    id: String(item.id),
    status: String(item.status ?? ""),
    currentStage: String(item.currentStage ?? ""),
    jobTitle: String(
      (item as { jobOpening?: { title?: string } }).jobOpening?.title ?? "Job"
    ),
    createdAt: item.createdAt as Date | string,
  }));
  const communications = communicationsResult.items
    .map(toCommunicationThreadMessageView)
    .sort((a, b) => {
      const aTime = new Date(a.sentAt ?? a.createdAt).getTime();
      const bTime = new Date(b.sentAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

  const mergedTimeline = mergeCandidateRecruitmentTimeline({
    timeline,
    communications: communicationsResult.items,
  });

  const canWriteCommunications =
    canAccessHRAdministration(session.role) || scope.capabilities.isRecruiterOnJob;

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={candidate.fullName}
        description={
          candidate.currentTitle && candidate.currentCompany
            ? `${candidate.currentTitle} at ${candidate.currentCompany}`
            : "Candidate workspace — profile, applications, docs, and outreach."
        }
        backHref="/admin/recruitment/candidates"
        backLabel="Back to candidates"
        action={
          <Button asChild className="shadow-subtle font-semibold">
            <Link href={`/admin/recruitment/candidates/${candidate.id}/edit`}>Edit</Link>
          </Button>
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
        communications={communications}
        mergedTimeline={mergedTimeline}
        canWriteCommunications={canWriteCommunications}
      />
    </div>
  );
}
