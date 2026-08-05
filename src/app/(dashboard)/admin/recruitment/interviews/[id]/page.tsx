import React from "react";
import { notFound } from "next/navigation";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { canAccessHRAdministration } from "@/lib/permissions";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { InterviewDetailView } from "@/components/recruitment/interviews/interview-detail";
import { EntityCommunicationTimeline } from "@/components/recruitment/communications/widgets/entity-communication-timeline";
import { getInterviewCached } from "@/lib/recruitment/interview/queries";
import { listCommunicationsCached } from "@/lib/recruitment/communication";
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

  const candidateId =
    typeof interview.application === "object" &&
    interview.application &&
    "candidateId" in interview.application
      ? String((interview.application as { candidateId?: string }).candidateId ?? "")
      : "";

  let communicationItems: Array<{
    id: string;
    subject: string;
    status: string;
    type: string;
    threadId: string | null;
    occurredAt: string;
  }> = [];

  if (canManage) {
    const communications = await listCommunicationsCached(session, {
      interviewId: interview.id,
      page: 1,
      pageSize: 10,
    });
    communicationItems = communications.items.map((item) => ({
      id: item.id,
      subject: item.subject,
      status: item.status,
      type: item.type,
      threadId: item.threadId,
      occurredAt:
        item.sentAt instanceof Date
          ? item.sentAt.toISOString()
          : item.createdAt instanceof Date
            ? item.createdAt.toISOString()
            : String(item.sentAt ?? item.createdAt),
    }));
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
      {canManage ? (
        <EntityCommunicationTimeline
          title="Communication timeline"
          composeHref={`/admin/recruitment/communications/new?interviewId=${encodeURIComponent(interview.id)}${
            candidateId ? `&candidateId=${encodeURIComponent(candidateId)}` : ""
          }&templateId=${encodeURIComponent("system:interview_invitation")}`}
          emptyDescription="No interview-related communications yet."
          items={communicationItems}
        />
      ) : null}
    </div>
  );
}
