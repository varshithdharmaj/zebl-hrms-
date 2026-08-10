import React from "react";
import { notFound } from "next/navigation";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { InterviewDetailView } from "@/components/recruitment/interviews/interview-detail";
import { getInterviewCached } from "@/lib/recruitment/interview/queries";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export default async function EmployeeInterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isRecruitmentModuleEnabled()) {
    notFound();
  }

  const session = await getSessionOrThrow();
  const { id } = await params;

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

  const isPanelist = interview.panelists.some(
    (p) => p.employee?.user?.id === session.id
  );

  if (!isPanelist) {
    notFound();
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Interview Details"
        description="Review interview information and submit your scorecard."
      />
      <InterviewDetailView
        interview={interview}
        currentUserId={session.id}
        canManage={false}
        backHref="/employee/interviews"
      />
    </div>
  );
}
