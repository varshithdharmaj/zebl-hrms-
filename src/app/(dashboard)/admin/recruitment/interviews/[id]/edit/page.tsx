import React from "react";
import { notFound } from "next/navigation";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { InterviewForm } from "@/components/recruitment/interviews/interview-form";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { getInterviewCached } from "@/lib/recruitment/interview/queries";
import { getEmployeeOptions } from "@/lib/recruitment/shared/employees";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";

export default async function EditInterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRecruitmentAdminSession();
  const { id } = await params;

  const interview = await getInterviewCached(session, id);
  if (!interview) {
    notFound();
  }

  const employees = await getEmployeeOptions();

  const application = interview.application;
  const candidate = application?.candidate;
  const jobOpening = application?.jobOpening;

  return (
    <div className="space-y-6 lg:space-y-8">
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "interviews",
          candidate: candidate
            ? { id: candidate.id, name: candidate.fullName }
            : null,
          job: jobOpening ? { id: jobOpening.id, title: jobOpening.title } : null,
          application: application
            ? { id: application.id, jobTitle: jobOpening?.title }
            : null,
          leafLabel: "Edit Interview",
        })}
      />
      <WorkspacePageHeader
        title="Edit Interview"
        description="Reschedule or update interview details and panelists."
        backHref={`/admin/recruitment/interviews/${interview.id}`}
        backLabel="Back to interview"
      />
      <InterviewForm mode="edit" interview={interview} employees={employees} />
    </div>
  );
}
