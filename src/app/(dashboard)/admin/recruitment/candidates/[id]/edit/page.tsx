import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { getCandidateCached, getEmployeeOptions } from "@/lib/recruitment/candidate";
import { isRecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { CandidateForm } from "@/components/recruitment/candidates/candidate-form";
import { CandidateErrorView } from "@/components/recruitment/candidates/candidate-error-view";

export default async function EditCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRecruitmentAdminSession();
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
              description="You do not have permissions to edit this candidate profile."
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

  const employees = await getEmployeeOptions();

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={`Edit ${candidate.fullName}`}
        description="Modify candidate details, contact information, and status."
        backHref={`/admin/recruitment/candidates/${candidate.id}`}
        backLabel="Back to profile"
      />

      <CandidateForm mode="edit" candidate={candidate} employees={employees} />
    </div>
  );
}
