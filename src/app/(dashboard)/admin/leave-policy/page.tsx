import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { LeavePolicyDocumentView } from "@/components/leave/leave-policy-document-view";
import { getActiveLeavePolicyDocument } from "@/lib/leave/leave-policy-document";
import { SectionCard } from "@/components/ui/section-card";

export default async function AdminLeavePolicyPage() {
  const document = await getActiveLeavePolicyDocument();

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Leave Policy"
        description="The published, employee-facing leave policy document. Read-only — configure the underlying rules in Leave Settings."
      />
      <SectionCard title="Company Leave Policy">
        <LeavePolicyDocumentView document={document} />
      </SectionCard>
    </div>
  );
}
