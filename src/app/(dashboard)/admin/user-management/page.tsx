import { redirect } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { UserManagementView } from "@/components/admin/user-management-view";
import { getSession } from "@/lib/auth";
import { canAccessPlatformAdministration } from "@/lib/permissions";
import { listUsers } from "@/lib/admin/user-management";
import { isAppUserRole, type AppUserRole } from "@/lib/roles";

export default async function UserManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Platform administration (user & role management) is Super Admin only — HR uses the
  // rest of the /admin shell but cannot reach this page.
  if (!canAccessPlatformAdministration(session.role)) redirect("/admin/dashboard");

  const { q, role, status, page } = await searchParams;
  const roleFilter: AppUserRole | undefined = role && isAppUserRole(role) ? role : undefined;
  const statusFilter: "active" | "inactive" | undefined =
    status === "active" || status === "inactive" ? status : undefined;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const { users, total, pageSize } = await listUsers({
    q,
    role: roleFilter,
    status: statusFilter,
    page: pageNum,
  });

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="User management"
        description={`Manage user roles and account access · ${total} total`}
      />
      <UserManagementView
        users={users}
        total={total}
        page={pageNum}
        pageSize={pageSize}
        currentUserId={session.id}
        filters={{ q, role: roleFilter, status: statusFilter }}
      />
    </div>
  );
}
