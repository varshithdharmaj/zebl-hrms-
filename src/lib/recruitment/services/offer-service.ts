import { Prisma } from "@/generated/prisma/client";
import { OfferStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { prismaOfferRepository } from "@/lib/recruitment/repositories/prisma-offer-repository";
import type {
  OfferDetail,
  OfferListFilters,
  OfferRepository,
} from "@/lib/recruitment/repositories/offer-repository";
import type { SearchFilters } from "@/lib/recruitment/types/pagination";
import type { z } from "zod";
import { prismaApplicationRepository } from "@/lib/recruitment/repositories/prisma-application-repository";
import { prismaDecisionRepository } from "@/lib/recruitment/repositories/prisma-decision-repository";
import { isOfferEligibleDecisionOutcome } from "@/lib/recruitment/decision/eligibility";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import {
  createOfferSchema,
  updateOfferSchema,
  sendOfferSchema,
  acceptOfferSchema,
  declineOfferSchema,
  withdrawOfferSchema,
  createOfferRevisionSchema,
  attachOfferPdfSchema,
} from "@/lib/validation/schemas/recruitment/offers";
import {
  buildOfferPdfStorageKey,
  isSafeOfferPdfKey,
} from "@/lib/recruitment/shared/storage-paths";
import {
  getRecruitmentStorage,
  type StorageAdapter,
} from "@/lib/recruitment/storage";

function generateOfferNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `OFFER-${year}-${rand}`;
}

export function createOfferService(
  repository: OfferRepository = prismaOfferRepository,
  storage: StorageAdapter = getRecruitmentStorage()
) {
  return {
    async createOffer(
      session: SessionUser,
      input: z.infer<typeof createOfferSchema>
    ): Promise<{ id: string }> {
      RecruitmentPermissionService.requireOffersEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const parsed = createOfferSchema.parse(input);

      // Verify application exists
      const app = await prismaApplicationRepository.getApplication(parsed.applicationId);
      if (!app) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      const settings = await prisma.recruitmentSettings.findUnique({
        where: { id: "default" },
        select: { requireDecisionForOffer: true },
      });
      const requireDecisionForOffer = settings?.requireDecisionForOffer ?? true;

      let hiringDecisionId = parsed.hiringDecisionId ?? null;
      if (requireDecisionForOffer) {
        const currentDecision = await prismaDecisionRepository.findCurrent(parsed.applicationId);
        if (!currentDecision) {
          throw new RecruitmentDomainError(
            "REC_VALIDATION",
            "Submit a hiring decision before creating an offer."
          );
        }
        if (!isOfferEligibleDecisionOutcome(currentDecision.outcome)) {
          throw new RecruitmentDomainError(
            "REC_VALIDATION",
            "Offers are only allowed after a strong_hire or hire decision."
          );
        }
        hiringDecisionId = currentDecision.id;
      }

      // Rule: Only ONE active offer allowed per application.
      const hasActive = await repository.existsActiveOffer(parsed.applicationId);
      if (hasActive) {
        throw new RecruitmentDomainError(
          "REC_CONFLICT",
          "An active offer already exists for this application. Please withdraw or decline it first."
        );
      }

      const offerNumber = generateOfferNumber();

      const events = createAfterCommitBuffer();
      const offerId = await withRecruitmentTransaction(async (tx) => {
        const { id } = await repository.createOffer(
          {
            ...parsed,
            hiringDecisionId,
            offerNumber,
            status: OfferStatus.draft,
            createdByUserId: session.id,
          },
          tx
        );

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: parsed.applicationId,
            applicationId: parsed.applicationId,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            eventType: "offer_created",
            summary: `Created offer draft: ${offerNumber} with CTC ${parsed.ctc} ${parsed.currency}`,
            actorUserId: session.id,
            metadata: { offerId: id, offerNumber, ctc: parsed.ctc },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.offerCreated(actor, {
            offerId: id,
            applicationId: parsed.applicationId,
          })
        );

        return id;
      });

      await events.flush();
      return { id: offerId };
    },

    async updateDraft(
      session: SessionUser,
      input: z.infer<typeof updateOfferSchema>
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const parsed = updateOfferSchema.parse(input);

      const offer = await repository.getOffer(parsed.id);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      if (offer.status !== OfferStatus.draft) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only draft offers can be updated directly. Create a revision instead."
        );
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateOffer(parsed.id, parsed, tx);

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_updated",
            summary: `Updated offer draft: ${offer.offerNumber}`,
            actorUserId: session.id,
            metadata: { offerId: parsed.id },
          },
          tx
        );
      });
    },

    async sendOffer(
      session: SessionUser,
      input: { id: string; expiresAt?: string | null }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const parsed = sendOfferSchema.parse(input);

      const offer = await repository.getOffer(parsed.id);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      if (offer.status !== OfferStatus.draft) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only draft offers can be sent."
        );
      }

      const expiresDate = parsed.expiresAt ? new Date(parsed.expiresAt) : null;

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.sendOffer(parsed.id, expiresDate, tx);

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_released", // Reusing existing timeline event type
            summary: `Sent offer: ${offer.offerNumber}`,
            actorUserId: session.id,
            metadata: { offerId: parsed.id, expiresAt: parsed.expiresAt },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.offerSent(actor, {
            offerId: parsed.id,
            applicationId: offer.applicationId,
          })
        );
      });

      await events.flush();
    },

    async withdrawOffer(
      session: SessionUser,
      input: { id: string; reason?: string | null }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      
      // Only HR and Super Admin may withdraw offers
      const isHrOrAdmin = ["hr", "super_admin"].includes(session.role);
      if (!isHrOrAdmin) {
        throw new RecruitmentDomainError(
          "REC_UNAUTHORIZED",
          "Only HR and Super Admins are authorized to withdraw offers."
        );
      }

      const parsed = withdrawOfferSchema.parse(input);

      const offer = await repository.getOffer(parsed.id);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      if (offer.status !== OfferStatus.released) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only sent/released offers can be withdrawn."
        );
      }

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.withdrawOffer(parsed.id, parsed.reason ?? null, tx);

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_withdrawn",
            summary: `Withdrawn offer: ${offer.offerNumber}. Reason: ${parsed.reason ?? "None"}`,
            actorUserId: session.id,
            metadata: { offerId: parsed.id, reason: parsed.reason },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.offerWithdrawn(actor, {
            offerId: parsed.id,
            applicationId: offer.applicationId,
            reason: parsed.reason ?? null,
          })
        );
      });

      await events.flush();
    },

    async expireOffer(session: SessionUser, id: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const offer = await repository.getOffer(id);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      if (offer.status !== OfferStatus.released) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only sent/released offers can expire."
        );
      }

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.expireOffer(id, tx);

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_expired",
            summary: `Offer expired: ${offer.offerNumber}`,
            actorUserId: session.id,
            metadata: { offerId: id },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.offerExpired(actor, {
            offerId: id,
            applicationId: offer.applicationId,
          })
        );
      });

      await events.flush();
    },

    async acceptOffer(
      session: SessionUser,
      input: { id: string; acceptedAt?: string | null }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const parsed = acceptOfferSchema.parse(input);

      const offer = await repository.getOffer(parsed.id);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      if (offer.status !== OfferStatus.released) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only sent/released offers can be accepted."
        );
      }

      const acceptedDate = parsed.acceptedAt ? new Date(parsed.acceptedAt) : new Date();

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.acceptOffer(parsed.id, acceptedDate, tx);

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_accepted",
            summary: `Offer accepted: ${offer.offerNumber}`,
            actorUserId: session.id,
            metadata: { offerId: parsed.id, acceptedAt: parsed.acceptedAt },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.offerAccepted(actor, {
            offerId: parsed.id,
            applicationId: offer.applicationId,
          })
        );
      });

      await events.flush();
    },

    async declineOffer(
      session: SessionUser,
      input: { id: string; declinedAt?: string | null; reason?: string | null }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const parsed = declineOfferSchema.parse(input);

      const offer = await repository.getOffer(parsed.id);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      if (offer.status !== OfferStatus.released) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only sent/released offers can be declined."
        );
      }

      const declinedDate = parsed.declinedAt ? new Date(parsed.declinedAt) : new Date();

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.declineOffer(parsed.id, declinedDate, parsed.reason ?? null, tx);

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_declined",
            summary: `Offer declined: ${offer.offerNumber}. Reason: ${parsed.reason ?? "None"}`,
            actorUserId: session.id,
            metadata: { offerId: parsed.id, declinedAt: parsed.declinedAt, reason: parsed.reason },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.offerDeclined(actor, {
            offerId: parsed.id,
            applicationId: offer.applicationId,
            reason: parsed.reason ?? null,
          })
        );
      });

      await events.flush();
    },

    async attachOfferPdf(
      session: SessionUser,
      input: {
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        content: Buffer | Uint8Array;
      }
    ): Promise<{ offerPdfKey: string }> {
      RecruitmentPermissionService.requireOffersEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const parsed = attachOfferPdfSchema.parse(input);
      const mime = parsed.mimeType.trim().toLowerCase();
      const lowerName = parsed.fileName.toLowerCase();
      if (!lowerName.endsWith(".pdf") || (mime !== "application/pdf" && mime !== "application/octet-stream")) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only PDF files can be attached to an offer."
        );
      }

      const offer = await repository.getOffer(parsed.id);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      const storageKey = buildOfferPdfStorageKey(parsed.id, parsed.fileName);
      await storage.save(storageKey, Buffer.from(input.content), {
        contentType: "application/pdf",
      });

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateOffer(parsed.id, { offerPdfKey: storageKey }, tx);

        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_updated",
            summary: `Attached offer PDF: ${parsed.fileName}`,
            actorUserId: session.id,
            metadata: { offerId: parsed.id, offerPdfKey: storageKey },
          },
          tx
        );
      });

      return { offerPdfKey: storageKey };
    },

    async getOfferPdfContent(
      session: SessionUser,
      offerId: string
    ): Promise<{ content: Buffer; fileName: string; mimeType: string }> {
      RecruitmentPermissionService.requireOffersEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const offer = await repository.getOffer(offerId);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }
      if (!offer.offerPdfKey) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "No offer PDF attached.");
      }
      if (!isSafeOfferPdfKey(offerId, offer.offerPdfKey) && !offer.offerPdfKey.startsWith("offers/")) {
        // Allow legacy keys that were set as free-text paths before upload flow.
      }

      const content = await storage.read(offer.offerPdfKey);
      const fileName = offer.offerPdfKey.split("/").pop() || "offer.pdf";
      return {
        content: Buffer.from(content),
        fileName,
        mimeType: "application/pdf",
      };
    },

    async createRevision(
      session: SessionUser,
      input: {
        id: string;
        changeNote: string;
        patch: z.infer<typeof createOfferRevisionSchema>["patch"];
      }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const parsed = createOfferRevisionSchema.parse(input);

      const offer = await repository.getOffer(parsed.id);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      if (offer.status === OfferStatus.accepted) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Accepted offers cannot be revised. Convert the candidate or withdraw first."
        );
      }

      // Create snapshot of current offer fields
      const snapshot = {
        currency: offer.currency,
        baseSalary: offer.baseSalary.toString(),
        variablePay: offer.variablePay?.toString() ?? null,
        benefitsNotes: offer.benefitsNotes,
        proposedStartDate: offer.proposedStartDate,
        expiresAt: offer.expiresAt,
        employmentType: offer.employmentType,
        department: offer.department,
        location: offer.location,
        grade: offer.grade,
        reportingManagerId: offer.reportingManagerId,
        joiningDate: offer.joiningDate,
        ctc: offer.ctc?.toString() ?? null,
        salaryBreakdownJson: offer.salaryBreakdownJson,
        bonus: offer.bonus?.toString() ?? null,
        stock: offer.stock,
        probationDays: offer.probationDays,
        noticeBuyout: offer.noticeBuyout,
        offerPdfKey: offer.offerPdfKey,
        offerNotes: offer.offerNotes,
      };

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        // Save revision snapshot
        const { id: revisionId } = await repository.createRevision(
          parsed.id,
          snapshot as unknown as Prisma.InputJsonValue,
          parsed.changeNote,
          session.id,
          tx
        );

        // Apply patch and reset status to draft for renegotiation/approval
        await repository.updateOffer(
          parsed.id,
          {
            ...parsed.patch,
            status: OfferStatus.draft,
          },
          tx
        );

        // Find latest version to publish
        const latestRev = await repository.latestRevision(parsed.id);
        const version = latestRev?.version ?? 1;

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_updated",
            summary: `Created offer revision v${version}: ${offer.offerNumber}. Note: ${parsed.changeNote}`,
            actorUserId: session.id,
            metadata: { offerId: parsed.id, revisionId, version },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.offerRevisionCreated(actor, {
            offerId: parsed.id,
            applicationId: offer.applicationId,
            version,
          })
        );
      });

      await events.flush();
    },

    async duplicateOffer(session: SessionUser, id: string): Promise<{ id: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const offer = await repository.getOffer(id);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      // Rule: Only ONE active offer allowed per application.
      const hasActive = await repository.existsActiveOffer(offer.applicationId);
      if (hasActive) {
        throw new RecruitmentDomainError(
          "REC_CONFLICT",
          "An active offer already exists for this application. Please withdraw or decline it first."
        );
      }

      const offerNumber = generateOfferNumber();

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();
      const newOfferId = await withRecruitmentTransaction(async (tx) => {
        const { id: createdId } = await repository.createOffer(
          {
            applicationId: offer.applicationId,
            hiringDecisionId: offer.hiringDecisionId,
            currency: offer.currency,
            baseSalary: Number(offer.baseSalary),
            variablePay: offer.variablePay ? Number(offer.variablePay) : null,
            benefitsNotes: offer.benefitsNotes,
            proposedStartDate: offer.proposedStartDate,
            expiresAt: offer.expiresAt,
            offerNumber,
            status: OfferStatus.draft,
            employmentType: offer.employmentType,
            department: offer.department,
            location: offer.location,
            grade: offer.grade,
            reportingManagerId: offer.reportingManagerId,
            joiningDate: offer.joiningDate,
            ctc: offer.ctc ? Number(offer.ctc) : 0,
            salaryBreakdownJson:
              offer.salaryBreakdownJson == null
                ? undefined
                : (offer.salaryBreakdownJson as unknown as Prisma.InputJsonValue),
            bonus: offer.bonus ? Number(offer.bonus) : null,
            stock: offer.stock,
            probationDays: offer.probationDays,
            noticeBuyout: offer.noticeBuyout,
            offerPdfKey: offer.offerPdfKey,
            offerNotes: `Duplicated from ${offer.offerNumber}`,
            createdByUserId: session.id,
          },
          tx
        );

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_created",
            summary: `Duplicated offer ${offer.offerNumber} to new draft ${offerNumber}`,
            actorUserId: session.id,
            metadata: { offerId: createdId, offerNumber },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.offerCreated(actor, {
            offerId: createdId,
            applicationId: offer.applicationId,
          })
        );

        return createdId;
      });

      await events.flush();
      return { id: newOfferId };
    },

    async getOffer(session: SessionUser, id: string): Promise<OfferDetail | null> {
      RecruitmentPermissionService.requireOffersEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);
      const offer = await repository.getOffer(id);
      if (!offer) return null;
      RecruitmentScopeEngine.assertApplicationInScope(scope, offer.applicationId);
      return offer;
    },

    async listOffers(
      session: SessionUser,
      args: {
        filters?: OfferListFilters | SearchFilters;
        pagination: { page: number; pageSize: number };
        sort?: { field: string; direction: "asc" | "desc" };
      }
    ) {
      const scope = await RecruitmentScopeEngine.getScope(session);
      return repository.listOffers({
        scope,
        filters: args.filters,
        pagination: args.pagination,
        sort: args.sort,
      });
    },

    async getDashboardMetrics(session: SessionUser, _filters?: unknown): Promise<Record<string, unknown>> {
      RecruitmentPermissionService.requireOffersEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);
      const scopeWhere =
        scope.mode === "unrestricted"
          ? {}
          : { applicationId: { in: [...scope.applicationIds] } };

      const [total, draft, sent, accepted, declined, withdrawn, expiredReleased, expiredNoted] =
        await Promise.all([
          prisma.offer.count({ where: scopeWhere }),
          prisma.offer.count({ where: { status: OfferStatus.draft, ...scopeWhere } }),
          prisma.offer.count({
            where: {
              status: OfferStatus.released,
              OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
              ...scopeWhere,
            },
          }),
          prisma.offer.count({ where: { status: OfferStatus.accepted, ...scopeWhere } }),
          prisma.offer.count({
            where: {
              status: OfferStatus.declined,
              NOT: { offerNotes: { contains: "Offer Expired" } },
              ...scopeWhere,
            },
          }),
          prisma.offer.count({ where: { status: OfferStatus.withdrawn, ...scopeWhere } }),
          prisma.offer.count({
            where: {
              status: OfferStatus.released,
              expiresAt: { lt: new Date() },
              ...scopeWhere,
            },
          }),
          prisma.offer.count({
            where: {
              status: OfferStatus.declined,
              offerNotes: { contains: "Offer Expired" },
              ...scopeWhere,
            },
          }),
        ]);

      const totalClosed = accepted + declined + withdrawn;
      const acceptanceRate =
        totalClosed > 0 ? parseFloat(((accepted / totalClosed) * 100).toFixed(1)) : 0;

      return {
        total,
        draft,
        sent,
        accepted,
        declined,
        withdrawn,
        expired: expiredReleased + expiredNoted,
        acceptanceRate,
      };
    },
  };
}
