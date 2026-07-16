import { redirect } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { NotificationPreferencesForm } from "@/components/employee/notification-preferences-form";
import { ChangePasswordForm } from "@/components/employee/change-password-form";
import { getSession } from "@/lib/auth";
import { canAccessManagerShell } from "@/lib/permissions";
import { getNotificationPreferencesForUser } from "@/actions/notifications";

export default async function ManagerSettingsPage() {
  const session = await getSession();
  if (!session || !canAccessManagerShell(session.role)) redirect("/login");

  const prefs = await getNotificationPreferencesForUser(session.id);

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Settings"
        description="Manage how you receive leave and approval notifications."
      />
      <NotificationPreferencesForm preferences={prefs} />
      <ChangePasswordForm />
    </div>
  );
}
