import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { CandidateForm } from "@/components/recruitment/candidates/candidate-form";

export default async function NewCandidatePage() {
  const session = await requireHROrSuperAdminSession();
  const employees = await getEmployeeOptions();

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="New Candidate"
        description="Create a new candidate profile in the ATS."
        backHref="/admin/recruitment/candidates"
        backLabel="Back to candidates"
      />

      <CandidateForm mode="create" employees={employees} />
    </div>
  );
}
