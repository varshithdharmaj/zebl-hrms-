import { redirect } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { TicketCreateForm } from "@/components/employee/ticket-create-form";
import { getSession } from "@/lib/auth";

export default async function NewTicketPage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Raise a Ticket"
        description="Submit a helpdesk request or raise a concern."
      />

      <TicketCreateForm />
    </div>
  );
}
