import { redirect } from "next/navigation";
import Link from "next/link";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { NotificationPreferencesForm } from "@/components/employee/notification-preferences-form";
import { ChangePasswordForm } from "@/components/employee/change-password-form";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getNotificationPreferencesForUser } from "@/actions/notifications";

export default async function EmployeeSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const prefs = await getNotificationPreferencesForUser(session.id);

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Settings"
        description="Manage notifications, security, and your profile photo."
      />
      <SectionCard
        title="Profile photo"
        description="Upload or change the photo shown on your profile and dashboard."
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/employee/profile">Open profile photo settings</Link>
        </Button>
      </SectionCard>
      <NotificationPreferencesForm preferences={prefs} />
      <ChangePasswordForm />
    </div>
  );
}
