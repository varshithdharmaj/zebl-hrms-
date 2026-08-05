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
  const session = await requireHROrSuperAdminSession();
  const rawParams = await searchParams;

  const applicationId = typeof rawParams.applicationId === "string" ? rawParams.applicationId : undefined;

  // Fetch employees for Reporting Manager select
  const employees = await getEmployeeOptions();

  // Fetch applications that don't have an active offer, or fetch all applications
  const applications = await prisma.application.findMany({
    where: {
      deletedAt: null,
    },
    include: {
      candidate: true,
      jobOpening: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

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
