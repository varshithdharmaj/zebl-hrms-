import { Suspense } from "react";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { NewCandidateFlow } from "@/components/recruitment/candidates/new-candidate-flow";
import { CandidateLoadingSkeleton } from "@/components/recruitment/candidates/candidate-loading-skeleton";

export default async function NewCandidatePage() {
  await requireHROrSuperAdminSession();
  const employees = await getEmployeeOptions();

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Add Candidate"
        description="Upload a resume or create a candidate profile manually."
        backHref="/admin/recruitment/candidates"
        backLabel="Back to candidates"
      />

      <Suspense fallback={<CandidateLoadingSkeleton />}>
        <NewCandidateFlow employees={employees} />
      </Suspense>
    </div>
  );
}
