import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { LeaveSettingsView } from "@/components/admin/leave-settings-view";
import { getSession } from "@/lib/auth";
import { canAccessHRAdministration } from "@/lib/permissions";
import { getLeavePolicySettings } from "@/lib/leave/leave-policy";

export default async function LeaveSettingsPage() {
  const session = await getSession();
  const canEdit = session ? canAccessHRAdministration(session.role) : false;

  const settings = await getLeavePolicySettings();

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Leave settings"
        description="Configure the organization's leave cycle, Earned Leave accrual rules, and Sick Leave policy."
      />
      <LeaveSettingsView settings={settings} canEdit={canEdit} />
    </div>
  );
}
