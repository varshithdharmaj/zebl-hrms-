import React from "react";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { InterviewForm } from "@/components/recruitment/interviews/interview-form";
import { prisma } from "@/lib/prisma";
import { getEmployeeOptions } from "@/lib/recruitment/shared/employees";

export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireHROrSuperAdminSession();
  const rawParams = await searchParams;
  const applicationId = typeof rawParams.applicationId === "string" ? rawParams.applicationId : undefined;

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
      <WorkspacePageHeader
        title="Schedule Interview"
        description="Schedule a new interview round and assign panelists."
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
