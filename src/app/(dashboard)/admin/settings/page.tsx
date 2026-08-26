import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { HrSettingsForm } from "@/components/admin/hr-settings-form";
import { getIntegrationSettings } from "@/lib/integrations/integration-settings";

export default async function AdminSettingsPage() {
  const settings = await getIntegrationSettings();

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="HR settings"
        description="Workflow escalation, notifications, and integration defaults."
      />
      <HrSettingsForm settings={settings} />
    </div>
  );
}
