import React from "react";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { OfferForm } from "@/components/recruitment/offers/offer-form";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import {
  parseRecruitmentNavSearch,
  resolveRecruitmentReturnTo,
  returnToLabel,
} from "@/lib/recruitment/navigation/return-to";
import { getEmployeeOptions } from "@/lib/recruitment/shared/employees";
import { prisma } from "@/lib/prisma";

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRecruitmentAdminSession();
  const rawParams = await searchParams;
  const nav = parseRecruitmentNavSearch(rawParams);

  const applicationId =
    typeof rawParams.applicationId === "string" ? rawParams.applicationId : undefined;
  const backHref = resolveRecruitmentReturnTo(
    nav.returnTo,
    applicationId
      ? `/admin/recruitment/applications/${applicationId}`
      : "/admin/recruitment/offers"
  );

  const employees = await getEmployeeOptions();

  const applicationRows = await prisma.application.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      candidate: {
        select: {
          firstName: true,
          lastName: true,
          fullName: true,
        },
      },
      jobOpening: {
        select: { title: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const applications = applicationRows.map((app) => ({
    id: app.id,
    candidate: {
      firstName: app.candidate.firstName,
      lastName: app.candidate.lastName,
      fullName: app.candidate.fullName,
    },
    jobOpening: {
      title: app.jobOpening.title,
    },
  }));

  return (
    <div className="space-y-6 lg:space-y-8">
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "offers",
          returnTo: nav.returnTo,
          application: applicationId ? { id: applicationId } : null,
          leafLabel: "Create Offer",
        })}
      />
      <WorkspacePageHeader
        title="Create Offer"
        description="Draft a new candidate offer package with compensation, benefits, and joining details."
        backHref={backHref}
        backLabel={returnToLabel(nav.returnTo, "Back")}
      />

      <OfferForm
        mode="create"
        applicationId={applicationId}
        applications={applications}
        employees={employees}
      />
    </div>
  );
}
