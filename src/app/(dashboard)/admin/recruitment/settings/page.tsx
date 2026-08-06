import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";

export default async function RecruitmentSettingsPage() {
  await requireHROrSuperAdminSession();

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Recruitment Settings"
        description="Hiring configuration for your team."
        backHref="/admin/recruitment"
        backLabel="Back to dashboard"
      />

      <SectionCard
        title="Email templates"
        description="Candidate email outreach is not enabled in this workspace. Collaboration happens via Discussion notes on each candidate."
      >
        <p className="text-sm text-muted-foreground">
          Template management remains available for future use but is hidden from day-to-day hiring
          flows.
        </p>
      </SectionCard>
    </div>
  );
}
