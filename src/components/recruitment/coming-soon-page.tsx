import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";

export function RecruitmentComingSoonPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={title}
        description={description ?? "Recruitment workspace foundation is loading."}
      />
      <EmptyState
        icon={Briefcase}
        title="Coming Soon"
        description="This recruitment surface is scaffolded and will be enabled in a later phase."
      />
    </div>
  );
}
