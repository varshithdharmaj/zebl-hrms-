import React from "react";
import { notFound } from "next/navigation";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { InterviewForm } from "@/components/recruitment/interviews/interview-form";
import { getInterviewCached } from "@/lib/recruitment/interview/queries";
import { getEmployeeOptions } from "@/lib/recruitment/shared/employees";

export default async function EditInterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireHROrSuperAdminSession();
  const { id } = await params;

  const interview = await getInterviewCached(session, id);
  if (!interview) {
    notFound();
  }

  const employees = await getEmployeeOptions();

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Edit Interview"
        description="Reschedule or update interview details and panelists."
      />
      <InterviewForm mode="edit" interview={interview} employees={employees} />
    </div>
  );
}
