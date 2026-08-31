import React from "react";
import { notFound } from "next/navigation";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { getOfferCached } from "@/lib/recruitment/offer/queries";
import { prismaTimelineProjectionRepository } from "@/lib/recruitment/repositories/prisma-timeline-repository";
import {
  OfferSummaryCard,
  type OfferSummaryCardOffer,
} from "@/components/recruitment/offers/offer-summary-card";
import {
  SalaryBreakdownCard,
  type SalaryBreakdownCardOffer,
} from "@/components/recruitment/offers/salary-breakdown-card";
import { OfferTimelineCard } from "@/components/recruitment/offers/offer-timeline-card";
import { OfferPDFViewer } from "@/components/recruitment/offers/offer-pdf-viewer";
import { OfferActivityCard } from "@/components/recruitment/offers/offer-activity-card";
import { OfferDetailActions } from "@/components/recruitment/offers/offer-detail-actions";
import { OfferStatusBadge } from "@/components/recruitment/offers/offer-status-badge";
import { OfferRevisionPanel } from "@/components/recruitment/offers/offer-revision-panel";
import { OfferStatus } from "@/generated/prisma/enums";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import {
  parseRecruitmentNavSearch,
  resolveRecruitmentReturnTo,
  returnToLabel,
} from "@/lib/recruitment/navigation/return-to";

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : String(value);
}

function asMoney(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return String(value);
  }
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

function asDateOrString(value: unknown): string | Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") return value;
  return null;
}

function toSalaryBreakdownCardOffer(
  offer: Record<string, unknown>
): SalaryBreakdownCardOffer {
  return {
    currency: typeof offer.currency === "string" ? offer.currency : "INR",
    stock: asNullableString(offer.stock),
    benefitsNotes: asNullableString(offer.benefitsNotes),
    baseSalary: asMoney(offer.baseSalary),
    variablePay: asMoney(offer.variablePay),
    bonus: asMoney(offer.bonus),
    ctc: asMoney(offer.ctc),
  };
}

function toOfferSummaryCardOffer(offer: Record<string, unknown>): OfferSummaryCardOffer {
  const applicationRaw = offer.application;
  let application: OfferSummaryCardOffer["application"] = null;
  if (applicationRaw != null && typeof applicationRaw === "object") {
    const app = applicationRaw as {
      candidate?: {
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        phone?: string | null;
      } | null;
      jobOpening?: { title?: string | null } | null;
    };
    application = {
      candidate: app.candidate ?? null,
      jobOpening: app.jobOpening ?? null,
    };
  }

  return {
    department: asNullableString(offer.department),
    location: asNullableString(offer.location),
    employmentType: asNullableString(offer.employmentType),
    grade: asNullableString(offer.grade),
    probationDays: asNullableInt(offer.probationDays),
    noticeBuyout: offer.noticeBuyout === true,
    joiningDate: asDateOrString(offer.joiningDate),
    expiresAt: asDateOrString(offer.expiresAt),
    application,
  };
}

export default async function OfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRecruitmentAdminSession();
  const { id } = await params;
  const nav = parseRecruitmentNavSearch((await searchParams) ?? {});

  const offer = await getOfferCached(session, id);
  if (!offer) {
    notFound();
  }

  const timeline = await prismaTimelineProjectionRepository.listByApplication(
    offer.applicationId
  );

  const applicationRaw = offer.application as
    | {
        id?: string;
        candidate?: {
          id?: string;
          firstName?: string | null;
          lastName?: string | null;
          fullName?: string | null;
        } | null;
        jobOpening?: { id?: string; title?: string | null } | null;
      }
    | null
    | undefined;
  const candidate = applicationRaw?.candidate ?? null;
  const candidateName =
    candidate?.fullName?.trim() ||
    `${candidate?.firstName ?? ""} ${candidate?.lastName ?? ""}`.trim() ||
    "Candidate";
  const candidateId = typeof candidate?.id === "string" ? candidate.id : undefined;
  const jobOpening = applicationRaw?.jobOpening;
  const jobId = jobOpening && typeof jobOpening.id === "string" ? jobOpening.id : undefined;
  const jobTitle =
    jobOpening && typeof jobOpening.title === "string" ? jobOpening.title : undefined;
  const applicationId =
    typeof offer.applicationId === "string"
      ? offer.applicationId
      : typeof applicationRaw?.id === "string"
        ? applicationRaw.id
        : undefined;
  const backHref = resolveRecruitmentReturnTo(nav.returnTo, "/admin/recruitment/offers");

  const revisionCount = offer.revisions?.length ?? 0;
  const offerRecord = offer as unknown as Record<string, unknown>;

  return (
    <div className="space-y-6 lg:space-y-8">
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "offers",
          returnTo: nav.returnTo,
          candidate: candidateId ? { id: candidateId, name: candidateName } : null,
          job: jobId && jobTitle ? { id: jobId, title: jobTitle } : null,
          application: applicationId
            ? { id: applicationId, jobTitle: jobTitle }
            : null,
          leafLabel: offer.offerNumber || "Offer",
        })}
        status={typeof offer.status === "string" ? offer.status : undefined}
      />
      <WorkspacePageHeader
        title={offer.offerNumber || "Offer Detail"}
        description={`Offer letter package for ${candidateName}.`}
        backHref={backHref}
        backLabel={returnToLabel(nav.returnTo, "Back to offers")}
        action={
          <OfferDetailActions
            offer={{
              id: typeof offer.id === "string" ? offer.id : "",
              status:
                typeof offer.status === "string" &&
                (Object.values(OfferStatus) as string[]).includes(offer.status)
                  ? (offer.status as OfferStatus)
                  : OfferStatus.draft,
              offerPdfKey: asNullableString(offer.offerPdfKey),
              releasedAt: asDateOrString(offerRecord.releasedAt),
              acceptedAt: asDateOrString(offerRecord.acceptedAt),
              declinedAt: asDateOrString(offerRecord.declinedAt),
              withdrawnAt: asDateOrString(offerRecord.withdrawnAt),
              declineReason: asNullableString(offerRecord.declineReason),
              withdrawReason: asNullableString(offerRecord.withdrawReason),
            }}
            userRole={session.role}
          />
        }
      />

      {/* Header Status & Revision Info */}
      <div className="flex flex-wrap gap-3 items-center bg-card border border-border rounded-xl p-4 shadow-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Status:
          </span>
          <OfferStatusBadge status={offer.status} expiresAt={asDateOrString(offerRecord.expiresAt)} />
        </div>
        <div className="h-4 w-px bg-border hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Revision:
          </span>
          <span className="inline-flex items-center rounded bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            v{revisionCount + 1}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          <OfferSummaryCard offer={toOfferSummaryCardOffer(offerRecord)} />
          <SalaryBreakdownCard offer={toSalaryBreakdownCardOffer(offerRecord)} />
          <OfferRevisionPanel
            offerId={offer.id}
            revisions={(offer.revisions ?? []) as never[]}
            canRevise={
              offer.status !== OfferStatus.accepted &&
              ["hr", "super_admin"].includes(session.role)
            }
          />
        </div>

        {/* Right 1 Column */}
        <div className="space-y-6">
          <OfferPDFViewer offer={offer} />
          <OfferActivityCard
            offer={{
              offerNotes:
                typeof offer.offerNotes === "string" ? offer.offerNotes : null,
            }}
          />
          <OfferTimelineCard timeline={timeline} />
        </div>
      </div>
    </div>
  );
}
