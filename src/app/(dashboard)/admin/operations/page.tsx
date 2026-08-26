import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { AdminOperationsView } from "@/components/admin/admin-operations-view";
import { getOperationsDashboard } from "@/lib/operations/ops-queries";

export default async function AdminOperationsPage() {
  const data = await getOperationsDashboard();

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Operations"
        description="Worker health, queue depth, failed jobs, and workflow integrity at a glance."
      />
      <AdminOperationsView data={data} />
    </div>
  );
}
