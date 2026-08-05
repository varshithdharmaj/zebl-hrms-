import React from "react";
import { notFound } from "next/navigation";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { getOfferCached } from "@/lib/recruitment/offer/queries";
import { OfferForm } from "@/components/recruitment/offers/offer-form";
import { getEmployeeOptions } from "@/lib/recruitment/shared/employees";
import { prisma } from "@/lib/prisma";

export default async function EditOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireHROrSuperAdminSession();
  const { id } = await params;

  const offer = await getOfferCached(session, id);
  if (!offer) {
    notFound();
  }

  // Fetch employees for Reporting Manager select
  const employees = await getEmployeeOptions();

  // Fetch applications for the select dropdown
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
        title={`Edit Offer: ${offer.offerNumber || ""}`}
        description="Modify the compensation, benefits, and joining details of this offer draft."
      />

      <OfferForm
        mode="edit"
        offer={offer}
        applications={applications}
        employees={employees}
      />
    </div>
  );
}
