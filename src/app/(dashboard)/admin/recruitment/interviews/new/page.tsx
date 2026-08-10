import React from "react";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { InterviewForm } from "@/components/recruitment/interviews/interview-form";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { prisma } from "@/lib/prisma";
import { getEmployeeOptions } from "@/lib/recruitment/shared/employees";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import {
  parseRecruitmentNavSearch,
  resolveRecruitmentReturnTo,
  returnToLabel,
} from "@/lib/recruitment/navigation/return-to";

export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireHROrSuperAdminSession();
  const rawParams = await searchParams;
  const nav = parseRecruitmentNavSearch(rawParams);
  const applicationId = typeof rawParams.applicationId === "string" ? rawParams.applicationId : undefined;
  const backHref = resolveRecruitmentReturnTo(
    nav.returnTo,
    applicationId
      ? `/admin/recruitment/applications/${applicationId}`
      : "/admin/recruitment/interviews"
  );

  // Fetch active applications for selection if not pre-selected
  const applications = await prisma.application.findMany({
    where: { deletedAt: null },
    include: {
      candidate: { select: { fullName: true } },
      jobOpening: { select: { title: true } },
    },
  });

  const employees = await getEmployeeOptions();

  return (
    <div className="space-y-6 lg:space-y-8">
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "interviews",
          returnTo: nav.returnTo,
          application: applicationId ? { id: applicationId } : null,
          leafLabel: "Schedule Interview",
        })}
      />
      <WorkspacePageHeader
        title="Schedule Interview"
        description="Schedule a new interview round and assign panelists."
        backHref={backHref}
        backLabel={returnToLabel(nav.returnTo, "Back")}
      />
      <InterviewForm
        mode="create"
        applicationId={applicationId}
        applications={applications}
        employees={employees}
      />
    </div>
  );
}
