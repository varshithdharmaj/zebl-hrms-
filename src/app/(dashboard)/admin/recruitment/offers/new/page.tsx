import React from "react";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { OfferForm } from "@/components/recruitment/offers/offer-form";
import { getEmployeeOptions } from "@/lib/recruitment/shared/employees";
import { prisma } from "@/lib/prisma";

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireHROrSuperAdminSession();
  const rawParams = await searchParams;

  const applicationId =
    typeof rawParams.applicationId === "string" ? rawParams.applicationId : undefined;

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
      <WorkspacePageHeader
        title="Create Offer"
        description="Draft a new candidate offer package with compensation, benefits, and joining details."
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
