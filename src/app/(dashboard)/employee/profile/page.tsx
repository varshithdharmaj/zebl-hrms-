import { redirect } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { EmployeePhotoAvatar } from "@/components/shared/employee-photo-avatar";
import { SectionCard } from "@/components/ui/section-card";
import { getSession } from "@/lib/auth";
import { canEditEmployeeProfilePhoto } from "@/lib/permissions";

export default async function EmployeeSelfProfilePage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const displayName = session.employeeName ?? session.email;
  const canEditPhoto = canEditEmployeeProfilePhoto({
    actorRole: session.role,
    actorEmployeeId: session.employeeId,
    targetEmployeeId: session.employeeId,
  });

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        leading={
          <EmployeePhotoAvatar
            userId={session.id}
            imageUrl={session.profilePhotoUrl ?? null}
            alt={`${displayName} profile photo`}
            editable={canEditPhoto}
            size="lg"
          />
        }
        title="My Profile"
        description="Update the profile photo other people see across the app."
      />

      <SectionCard title="Identity" description="Details from your signed-in account">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium text-foreground">{session.employeeName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">{session.email}</dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}
