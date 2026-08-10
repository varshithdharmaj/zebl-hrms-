import React from "react";
import { notFound } from "next/navigation";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { canAccessHRAdministration } from "@/lib/permissions";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { InterviewDetailView } from "@/components/recruitment/interviews/interview-detail";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { getInterviewCached } from "@/lib/recruitment/interview/queries";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import {
  parseRecruitmentNavSearch,
  resolveRecruitmentReturnTo,
  returnToLabel,
} from "@/lib/recruitment/navigation/return-to";

export default async function InterviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionOrThrow();
  const { id } = await params;
  const nav = parseRecruitmentNavSearch((await searchParams) ?? {});
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

  const application = interview.application;
  const candidate = application?.candidate;
  const jobOpening = application?.jobOpening;
  const backHref = resolveRecruitmentReturnTo(nav.returnTo, "/admin/recruitment/interviews");

  return (
    <div className="space-y-6 lg:space-y-8">
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "interviews",
          returnTo: nav.returnTo,
          candidate: candidate
            ? { id: candidate.id, name: candidate.fullName }
            : null,
          job: jobOpening ? { id: jobOpening.id, title: jobOpening.title } : null,
          application: application
            ? { id: application.id, jobTitle: jobOpening?.title }
            : null,
          leafLabel: interview.title || "Interview",
        })}
        status={interview.status}
      />
      <WorkspacePageHeader
        title="Interview Details"
        description="Manage round details, panelists, and feedback scorecards."
        backHref={backHref}
        backLabel={returnToLabel(nav.returnTo, "Back to interviews")}
      />
      <InterviewDetailView
        interview={interview}
        currentUserId={session.id}
        canManage={canManage}
        backHref={backHref}
      />
    </div>
  );
}
