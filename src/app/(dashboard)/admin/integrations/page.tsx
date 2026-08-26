import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { TeamsSettingsForm } from "@/components/integrations/teams-settings";
import { CalendarSyncStatusPanel } from "@/components/integrations/calendar-sync-status";
import { IntegrationOpsPanel } from "@/components/integrations/integration-ops-panel";
import { getIntegrationSettingsAction } from "@/actions/integrations";

export default async function AdminIntegrationsPage() {
  const settings = await getIntegrationSettingsAction();

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Integrations"
        description="Microsoft Teams, Outlook calendar, Graph API health, and escalation automation"
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <TeamsSettingsForm settings={settings} />
        <div className="space-y-6">
          <IntegrationOpsPanel
            graphHealthStatus={settings.graphLastHealthStatus}
            graphHealthAt={settings.graphLastHealthAt}
          />
          <CalendarSyncStatusPanel />
        </div>
      </div>
    </div>
  );
}
