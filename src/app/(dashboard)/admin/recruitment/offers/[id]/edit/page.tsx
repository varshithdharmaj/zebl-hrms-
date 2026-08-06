import React from "react";
import { notFound } from "next/navigation";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { getOfferCached } from "@/lib/recruitment/offer/queries";
import { OfferForm } from "@/components/recruitment/offers/offer-form";
import { getEmployeeOptions } from "@/lib/recruitment/shared/employees";
import { prisma } from "@/lib/prisma";

function serializeOfferForForm(offer: Record<string, unknown>) {
  const toPlain = (value: unknown): string | null => {
    if (value == null) return null;
    if (typeof value === "object" && value !== null && "toString" in value) {
      return String(value);
    }
    return String(value);
  };

  return {
    ...offer,
    baseSalary: toPlain(offer.baseSalary),
    variablePay: toPlain(offer.variablePay),
    bonus: toPlain(offer.bonus),
    ctc: toPlain(offer.ctc),
    joiningDate: offer.joiningDate instanceof Date
      ? offer.joiningDate.toISOString()
      : offer.joiningDate,
    expiresAt: offer.expiresAt instanceof Date
      ? offer.expiresAt.toISOString()
      : offer.expiresAt,
    createdAt: offer.createdAt instanceof Date
      ? offer.createdAt.toISOString()
      : offer.createdAt,
    updatedAt: offer.updatedAt instanceof Date
      ? offer.updatedAt.toISOString()
      : offer.updatedAt,
  };
}

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
        title={`Edit Offer: ${offer.offerNumber || ""}`}
        description="Modify the compensation, benefits, and joining details of this offer draft."
      />

      <OfferForm
        mode="edit"
        offer={serializeOfferForForm(offer as Record<string, unknown>)}
        applications={applications}
        employees={employees}
      />
    </div>
  );
}
