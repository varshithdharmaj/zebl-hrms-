import { redirect } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { LeavePolicyDocumentView } from "@/components/leave/leave-policy-document-view";
import { getSession } from "@/lib/auth";
import { getActiveLeavePolicyDocument } from "@/lib/leave/leave-policy-document";
import { SectionCard } from "@/components/ui/section-card";

export default async function EmployeeLeavePolicyPage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const document = await getActiveLeavePolicyDocument();

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Leave Policy"
        description="The company's leave rules, read-only."
      />
      <SectionCard title="Company Leave Policy">
        <LeavePolicyDocumentView document={document} />
      </SectionCard>
    </div>
  );
}
