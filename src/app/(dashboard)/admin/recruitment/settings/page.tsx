import { Suspense } from "react";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { listTemplatesAdminCached } from "@/lib/recruitment/communication";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { CommunicationLoadingSkeleton } from "@/components/recruitment/communications/communication-loading-skeleton";
import { TemplateWorkspace } from "@/components/recruitment/communications/templates/template-workspace";
import { SectionCard } from "@/components/ui/section-card";

async function TemplatesLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireHROrSuperAdminSession();
  const params = await searchParams;
  const tabRaw = typeof params.tab === "string" ? params.tab : "active";
  const tab = tabRaw === "archived" ? "archived" : "active";

  const [active, archived] = await Promise.all([
    listTemplatesAdminCached(session, { tab: "active", includeSystem: true }),
    listTemplatesAdminCached(session, { tab: "archived", includeSystem: false }),
  ]);

  const templates = tab === "active" ? active : archived;

  return (
    <TemplateWorkspace
      initialTab={tab}
      initialTemplates={templates.map((template) => ({
        id: template.id,
        name: template.name,
        type: template.type,
        subject: template.subject,
        body: template.body,
        isSystem: template.isSystem,
        isActive: template.isActive,
        isDefault: template.isDefault,
        isVirtual: template.isVirtual,
      }))}
    />
  );
}

export default function RecruitmentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Recruitment Settings"
        description="Email templates and hiring configuration for your team."
        backHref="/admin/recruitment"
        backLabel="Back to dashboard"
      />

      <SectionCard
        title="Email Templates"
        description="Reusable messages for interviews, offers, and candidate outreach."
      >
        <Suspense fallback={<CommunicationLoadingSkeleton />}>
          <TemplatesLoader searchParams={searchParams} />
        </Suspense>
      </SectionCard>
    </div>
  );
}
