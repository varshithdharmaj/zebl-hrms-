import React from "react";
import { notFound } from "next/navigation";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { getOfferCached } from "@/lib/recruitment/offer/queries";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import {
  OfferForm,
  type OfferFormValues,
} from "@/components/recruitment/offers/offer-form";
import { getEmployeeOptions } from "@/lib/recruitment/shared/employees";
import { prisma } from "@/lib/prisma";

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

function asDateOrString(value: unknown): string | Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function asNullableInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asFormApplication(value: unknown): OfferFormValues["application"] {
  if (value == null || typeof value !== "object") return null;
  const app = value as {
    candidate?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
    jobOpening?: {
      title?: string | null;
    } | null;
  };
  return {
    candidate: app.candidate ?? null,
    jobOpening: app.jobOpening ?? null,
  };
}

function serializeOfferForForm(offer: Record<string, unknown>): OfferFormValues {
  return {
    id: typeof offer.id === "string" ? offer.id : "",
    applicationId: typeof offer.applicationId === "string" ? offer.applicationId : "",
    employmentType: asNullableString(offer.employmentType),
    department: asNullableString(offer.department),
    location: asNullableString(offer.location),
    grade: asNullableString(offer.grade),
    reportingManagerId: asNullableInt(offer.reportingManagerId),
    currency: typeof offer.currency === "string" ? offer.currency : "INR",
    stock: asNullableString(offer.stock),
    probationDays: asNullableInt(offer.probationDays),
    noticeBuyout: offer.noticeBuyout === true,
    offerPdfKey: asNullableString(offer.offerPdfKey),
    offerNotes: asNullableString(offer.offerNotes),
    benefitsNotes: asNullableString(offer.benefitsNotes),
    baseSalary: asNullableString(offer.baseSalary) ?? "0",
    variablePay: asNullableString(offer.variablePay),
    bonus: asNullableString(offer.bonus),
    ctc: asNullableString(offer.ctc),
    joiningDate: asDateOrString(offer.joiningDate),
    expiresAt: asDateOrString(offer.expiresAt),
    application: asFormApplication(offer.application),
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
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "offers",
          application:
            typeof offer.applicationId === "string"
              ? { id: offer.applicationId }
              : null,
          leafLabel: "Edit Offer",
        })}
      />
      <WorkspacePageHeader
        title={`Edit Offer: ${offer.offerNumber || ""}`}
        description="Modify the compensation, benefits, and joining details of this offer draft."
        backHref={`/admin/recruitment/offers/${id}`}
        backLabel="Back to offer"
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
