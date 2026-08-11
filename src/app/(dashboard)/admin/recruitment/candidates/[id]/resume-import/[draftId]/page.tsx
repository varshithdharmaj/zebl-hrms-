import Link from "next/link";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { createResumeImportService } from "@/lib/recruitment/services/resume-import-service";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { CandidateErrorView } from "@/components/recruitment/candidates/candidate-error-view";
import { ResumeImportReview } from "@/components/recruitment/candidates/resume-import/resume-import-review";
import { Button } from "@/components/ui/button";

export default async function ResumeImportDraftPage({
  params,
}: {
  params: Promise<{ id: string; draftId: string }>;
}) {
  const session = await requireRecruitmentAdminSession();
  const { id: candidateId, draftId } = await params;

  if (!isRecruitmentModuleEnabled()) {
    return (
      <div className="space-y-6">
        <WorkspacePageHeader
          title="Resume Import"
          description="Recruitment module is disabled."
          backHref="/admin/recruitment/candidates"
          backLabel="Back to candidates"
        />
      </div>
    );
  }

  try {
    const service = createResumeImportService();
    const review = await service.getReview(session, draftId);

    if (review.candidateId !== candidateId) {
      return (
        <div className="space-y-6">
          <WorkspacePageHeader
            title="Draft mismatch"
            description="This import draft does not belong to the requested candidate."
            backHref={`/admin/recruitment/candidates/${candidateId}`}
            backLabel="Back to candidate"
          />
          <CandidateErrorView type="not_found" />
        </div>
      );
    }

    return (
      <div className="space-y-6 lg:space-y-8">
        <WorkspacePageHeader
          title="Resume Import Review"
          description="Compare current profile with the import draft. Accept fields explicitly before applying."
          backHref={`/admin/recruitment/candidates/${candidateId}`}
          backLabel="Back to candidate"
          action={
            <Button asChild variant="outline" className="shadow-subtle">
              <Link href={`/admin/recruitment/candidates/${candidateId}`}>
                Open profile
              </Link>
            </Button>
          }
        />

        <ResumeImportReview
          draftId={review.draftId}
          candidateId={review.candidateId}
          status={review.status}
          content={review.content}
          scalars={review.scalars}
          sections={review.sections}
          candidate={review.candidate}
          candidateName={review.candidate.fullName}
        />
      </div>
    );
  } catch (error) {
    if (isRecruitmentDomainError(error)) {
      if (error.code === "REC_NOT_FOUND") {
        return (
          <div className="space-y-6">
            <WorkspacePageHeader
              title="Import draft not found"
              description={error.message}
              backHref={`/admin/recruitment/candidates/${candidateId}`}
              backLabel="Back to candidate"
            />
            <CandidateErrorView type="not_found" />
          </div>
        );
      }
      if (error.code === "REC_FORBIDDEN_SCOPE" || error.code === "REC_UNAUTHORIZED") {
        return (
          <div className="space-y-6">
            <WorkspacePageHeader
              title="Access denied"
              description={error.message}
              backHref="/admin/recruitment/candidates"
              backLabel="Back to candidates"
            />
            <CandidateErrorView type="permission_denied" />
          </div>
        );
      }
    }

    return (
      <div className="space-y-6">
        <WorkspacePageHeader
          title="Error"
          description="Could not load resume import draft."
          backHref={`/admin/recruitment/candidates/${candidateId}`}
          backLabel="Back to candidate"
        />
        <CandidateErrorView
          type="unexpected"
          message={error instanceof Error ? error.message : "Unexpected error."}
        />
      </div>
    );
  }
}
