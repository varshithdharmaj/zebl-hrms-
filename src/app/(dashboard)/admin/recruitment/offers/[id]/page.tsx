import React from "react";
import { notFound } from "next/navigation";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { getOfferCached } from "@/lib/recruitment/offer/queries";
import { prismaTimelineProjectionRepository } from "@/lib/recruitment/repositories/prisma-timeline-repository";
import { OfferSummaryCard } from "@/components/recruitment/offers/offer-summary-card";
import { SalaryBreakdownCard } from "@/components/recruitment/offers/salary-breakdown-card";
import { OfferTimelineCard } from "@/components/recruitment/offers/offer-timeline-card";
import { OfferApprovalCard } from "@/components/recruitment/offers/offer-approval-card";
import { OfferPDFViewer } from "@/components/recruitment/offers/offer-pdf-viewer";
import { OfferActivityCard } from "@/components/recruitment/offers/offer-activity-card";
import { OfferDetailActions } from "@/components/recruitment/offers/offer-detail-actions";
import { OfferStatusBadge } from "@/components/recruitment/offers/offer-status-badge";
import { EntityCommunicationTimeline } from "@/components/recruitment/communications/widgets/entity-communication-timeline";
import { listCommunicationsCached } from "@/lib/recruitment/communication";

export default async function OfferDetailPage({
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

  const [timeline, communications] = await Promise.all([
    prismaTimelineProjectionRepository.listByApplication(offer.applicationId),
    listCommunicationsCached(session, {
      offerId: offer.id,
      page: 1,
      pageSize: 10,
    }),
  ]);

  const candidate = offer.application?.candidate;
  const candidateName = candidate
    ? `${candidate.firstName} ${candidate.lastName}`
    : "Candidate";
  const candidateId = candidate?.id ?? offer.application?.candidateId ?? "";

  const revisionCount = offer.revisions?.length ?? 0;

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={offer.offerNumber || "Offer Detail"}
        description={`Offer letter package for ${candidateName}.`}
        action={
          <OfferDetailActions offer={offer} userRole={session.role} />
        }
      />

      {/* Header Status & Revision Info */}
      <div className="flex flex-wrap gap-3 items-center bg-card border border-border rounded-xl p-4 shadow-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Status:
          </span>
          <OfferStatusBadge status={offer.status} />
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
          <OfferSummaryCard offer={offer} />
          <SalaryBreakdownCard offer={offer} />
          <OfferApprovalCard offer={offer} />
        </div>

        {/* Right 1 Column */}
        <div className="space-y-6">
          <OfferPDFViewer offer={offer} />
          <OfferActivityCard offer={offer} />
          <OfferTimelineCard timeline={timeline} />
          <EntityCommunicationTimeline
            title="Communication timeline"
            composeHref={`/admin/recruitment/communications/new?offerId=${encodeURIComponent(offer.id)}${
              candidateId ? `&candidateId=${encodeURIComponent(candidateId)}` : ""
            }`}
            emptyDescription="No offer-related communications yet."
            items={communications.items.map((item) => ({
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
            }))}
          />
        </div>
      </div>
    </div>
  );
}
