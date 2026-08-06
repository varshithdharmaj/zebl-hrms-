import React from "react";
import { notFound } from "next/navigation";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { canAccessHRAdministration } from "@/lib/permissions";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { InterviewDetailView } from "@/components/recruitment/interviews/interview-detail";
import { getInterviewCached } from "@/lib/recruitment/interview/queries";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionOrThrow();
  const { id } = await params;
  const canManage = canAccessHRAdministration(session.role);

  let interview: Awaited<ReturnType<typeof getInterviewCached>>;
  try {
    interview = await getInterviewCached(session, id);
  } catch (error) {
    if (error instanceof RecruitmentDomainError && error.code === "REC_FORBIDDEN_SCOPE") {
      notFound();
    }
    throw error;
  }

  if (!interview) {
    notFound();
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Interview Details"
        description="Manage round details, panelists, and feedback scorecards."
      />
      <InterviewDetailView
        interview={interview}
        currentUserId={session.id}
        canManage={canManage}
      />
    </div>
  );
}
