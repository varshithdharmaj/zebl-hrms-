import { Prisma } from "@/generated/prisma/client";
import { OfferStatus, CandidateStatus } from "@/generated/prisma/enums";
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
  generateOfferLetterSchema,
} from "@/lib/validation/schemas/recruitment/offers";
import {
  buildOfferPdfStorageKey,
  isSafeOfferPdfKey,
} from "@/lib/recruitment/shared/storage-paths";
import {
  getRecruitmentStorage,
  type StorageAdapter,
} from "@/lib/recruitment/storage";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { buildOfferLetterTemplateData } from "@/lib/recruitment/pdf/offer-letter-data";
import { renderOfferLetterPdf } from "@/lib/recruitment/pdf/render-offer-letter-pdf";
import { buildOfferLetterFileName } from "@/lib/recruitment/pdf/filename";
import {
  sendOfferLetterEmail,
  type SendOfferLetterEmailInput,
  type SendOfferLetterEmailResult,
} from "@/lib/recruitment/email/send-offer-letter-email";
import { prismaCommunicationRepository } from "@/lib/recruitment/repositories/prisma-communication-repository";
import {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
} from "@/generated/prisma/enums";

type SendOfferLetterEmailFn = (
  input: SendOfferLetterEmailInput
) => Promise<SendOfferLetterEmailResult>;

async function fetchNextOfferNumber(): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const result = await prisma.$queryRaw<{ nextval: bigint | number }[]>`SELECT nextval('offer_number_seq')`;
    const nextVal = result[0]?.nextval;
    if (nextVal != null) {
      return `OFFER-${year}-${String(nextVal).padStart(4, "0")}`;
    }
  } catch (_err) {
    // Fallback if sequence is not present
  }
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `OFFER-${year}-${rand}`;
}

function calculateCtc(baseSalary: number, variablePay?: number | null, bonus?: number | null): number {
  const base = Number.isFinite(baseSalary) ? baseSalary : 0;
  const variable = variablePay != null && Number.isFinite(variablePay) ? variablePay : 0;
  const b = bonus != null && Number.isFinite(bonus) ? bonus : 0;
  return base + variable + b;
}

export function createOfferService(
  repository: OfferRepository = prismaOfferRepository,
  storage: StorageAdapter = getRecruitmentStorage(),
  sendEmail: SendOfferLetterEmailFn = sendOfferLetterEmail
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

      // Server-side CTC calculation
      const ctc = calculateCtc(parsed.baseSalary, parsed.variablePay, parsed.bonus);
      const offerNumber = parsed.offerNumber || (await fetchNextOfferNumber());

      const events = createAfterCommitBuffer();
      const offerId = await withRecruitmentTransaction(async (tx) => {
        const { id } = await repository.createOffer(
          {
            ...parsed,
            hiringDecisionId,
            offerNumber,
            ctc,
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
            summary: `Created offer draft: ${offerNumber} with CTC ${ctc} ${parsed.currency}`,
            actorUserId: session.id,
            metadata: { offerId: id, offerNumber, ctc },
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

      // Re-calculate CTC server-side
      const baseSalary = parsed.baseSalary ?? offer.baseSalary;
      const variablePay = parsed.variablePay !== undefined ? parsed.variablePay : offer.variablePay;
      const bonus = parsed.bonus !== undefined ? parsed.bonus : offer.bonus;
      const computedCtc = calculateCtc(baseSalary, variablePay, bonus);

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateOffer(
          parsed.id,
          {
            ...parsed,
            ctc: computedCtc,
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

      if (!offer.offerPdfKey) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Generate the offer letter before sending it to the candidate."
        );
      }

      const recipientEmail = offer.application.candidate.email;
      if (!recipientEmail) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "The candidate does not have an email address on file."
        );
      }

      const candidateName = offer.application.candidate.fullName;
      const designation = offer.application.jobOpening.title ?? "the role";
      const pdfContent = Buffer.from(await storage.read(offer.offerPdfKey));
      const fileName = offer.offerPdfKey.split("/").pop() || buildOfferLetterFileName(candidateName);

      // Send email synchronously before updating status
      const emailResult = await sendEmail({
        recipientEmail,
        candidateName,
        designation,
        fileName,
        pdfContent,
      });

      if (!emailResult.success) {
        await writeAuditLog({
          entityType: "offer",
          entityId: parsed.id,
          action: AUDIT_ACTIONS.RECRUITMENT_OFFER_LETTER_SEND_FAILED,
          metadata: { recipientEmail, error: emailResult.error },
        });
        throw new RecruitmentDomainError(
          "REC_INTERNAL",
          `Failed to email the offer letter: ${emailResult.error}`
        );
      }

      const expiresDate = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
      const events = createAfterCommitBuffer();

      await withRecruitmentTransaction(async (tx) => {
        await repository.sendOffer(parsed.id, expiresDate, session.id, tx);

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_released",
            summary: `Sent offer letter to ${recipientEmail}: ${offer.offerNumber}`,
            actorUserId: session.id,
            metadata: { offerId: parsed.id, expiresAt: parsed.expiresAt, recipientEmail },
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

      await writeAuditLog({
        entityType: "offer",
        entityId: parsed.id,
        action: AUDIT_ACTIONS.RECRUITMENT_OFFER_SENT,
        metadata: { recipientEmail, providerMessageId: emailResult.providerMessageId },
      });

      try {
        const { id: communicationId } = await prismaCommunicationRepository.createCommunication({
          type: RecruitmentCommunicationType.offer_letter,
          status: RecruitmentCommunicationStatus.sent,
          subject: `Offer Letter — ${designation} at ZEBL India Private Limited`,
          candidateId: offer.application.candidateId,
          applicationId: offer.applicationId,
          jobOpeningId: offer.application.jobOpeningId,
          offerId: parsed.id,
          senderUserId: session.id,
          recipientEmail,
          scheduledFor: null,
        });
        await prismaCommunicationRepository.updateCommunication(communicationId, {
          sentAt: new Date(),
        });
        await prismaCommunicationRepository.addAttachment(communicationId, {
          fileName,
          fileType: "application/pdf",
          fileSize: pdfContent.byteLength,
          storagePath: offer.offerPdfKey,
        });
      } catch (error) {
        console.error("[offer-service] Failed to record offer letter communication:", error);
      }
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
          "Only released offers can be accepted."
        );
      }

      const acceptedDate = parsed.acceptedAt ? new Date(parsed.acceptedAt) : new Date();
      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();

      await withRecruitmentTransaction(async (tx) => {
        // 1. Update offer status to accepted
        await repository.acceptOffer(parsed.id, acceptedDate, tx);

        // 2. Automatically create Employee record in the same Prisma transaction
        const candidate = offer.application.candidate;
        const fullName = candidate.fullName || "New Employee";
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = candidate.firstName || nameParts[0] || "";
        const lastName = candidate.lastName || nameParts.slice(1).join(" ") || "";
        const empCode = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

        await tx.employee.create({
          data: {
            employeeCode: empCode,
            name: fullName,
            firstName,
            lastName,
            email: candidate.email ?? null,
            phone: candidate.phone ?? null,
            department: offer.department ?? null,
            designation: offer.employmentType ?? offer.application.jobOpening.title ?? null,
            employmentType: offer.employmentType ?? null,
            workLocation: offer.location ?? null,
            joiningDate: offer.joiningDate ?? acceptedDate,
            managerId: offer.reportingManagerId ?? null,
            employeeStatus: "Active",
            isActive: true,
          },
        });

        // 3. Update candidate status to hired
        await tx.candidate.update({
          where: { id: candidate.id },
          data: { status: CandidateStatus.hired },
        });

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_accepted",
            summary: `Offer accepted: ${offer.offerNumber}. Employee record created (${empCode}).`,
            actorUserId: session.id,
            metadata: { offerId: parsed.id, acceptedAt: parsed.acceptedAt, employeeCode: empCode },
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
          "Only released offers can be declined."
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
          "Only released offers can expire."
        );
      }

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.expireOffer(id, tx);

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

        events.enqueue(
          RecruitmentEventFactory.offerExpired(actor, {
            offerId: id,
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
          "Only released offers can be withdrawn."
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
        await repository.updateOffer(
          parsed.id,
          {
            offerPdfKey: storageKey,
            letterGeneratedAt: null,
            letterGeneratedByUserId: null,
          },
          tx
        );

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

    async generateOfferLetter(
      session: SessionUser,
      input: { id: string }
    ): Promise<{ offerPdfKey: string; fileName: string }> {
      RecruitmentPermissionService.requireOffersEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const parsed = generateOfferLetterSchema.parse(input);

      const offer = await repository.getOffer(parsed.id);
      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      if (
        offer.status === OfferStatus.accepted ||
        offer.status === OfferStatus.declined ||
        offer.status === OfferStatus.withdrawn
      ) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "The offer letter cannot be regenerated once the offer has been accepted, declined, or withdrawn."
        );
      }

      const candidateName = offer.application.candidate.fullName;
      const designation = offer.application.jobOpening.title ?? null;

      const templateData = buildOfferLetterTemplateData({
        offer: {
          id: offer.id,
          offerNumber: offer.offerNumber,
          department: offer.department,
          location: offer.location,
          ctc: offer.ctc,
          joiningDate: offer.joiningDate,
          probationDays: offer.probationDays,
          noticeBuyout: offer.noticeBuyout,
          salaryBreakdownJson: offer.salaryBreakdownJson,
        },
        designation,
        candidateName,
      });

      const pdfContent = await renderOfferLetterPdf(templateData);
      const fileName = buildOfferLetterFileName(candidateName);
      const storageKey = buildOfferPdfStorageKey(offer.id, fileName);
      await storage.save(storageKey, pdfContent, { contentType: "application/pdf" });

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateOffer(
          offer.id,
          {
            offerPdfKey: storageKey,
            letterGeneratedAt: new Date(),
            letterGeneratedByUserId: session.id,
          },
          tx
        );

        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: offer.applicationId,
            applicationId: offer.applicationId,
            candidateId: offer.application.candidateId,
            jobOpeningId: offer.application.jobOpeningId,
            eventType: "offer_updated",
            summary: `Generated offer letter PDF: ${fileName}`,
            actorUserId: session.id,
            metadata: { offerId: offer.id, offerPdfKey: storageKey },
          },
          tx
        );
      });

      await writeAuditLog({
        entityType: "offer",
        entityId: offer.id,
        action: AUDIT_ACTIONS.RECRUITMENT_OFFER_LETTER_GENERATED,
        metadata: { offerPdfKey: storageKey, fileName },
      });

      return { offerPdfKey: storageKey, fileName };
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
          "Accepted offers cannot be revised."
        );
      }

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
        const { id: revisionId } = await repository.createRevision(
          parsed.id,
          snapshot as unknown as Prisma.InputJsonValue,
          parsed.changeNote,
          session.id,
          tx
        );

        await repository.updateOffer(
          parsed.id,
          {
            ...parsed.patch,
            status: OfferStatus.draft,
            offerPdfKey: null,
            letterGeneratedAt: null,
            letterGeneratedByUserId: null,
          },
          tx
        );

        const latestRev = await repository.latestRevision(parsed.id);
        const version = latestRev?.version ?? 1;

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

      const hasActive = await repository.existsActiveOffer(offer.applicationId);
      if (hasActive) {
        throw new RecruitmentDomainError(
          "REC_CONFLICT",
          "An active offer already exists for this application. Please withdraw or decline it first."
        );
      }

      const offerNumber = await fetchNextOfferNumber();
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
            offerPdfKey: null,
            offerNotes: `Duplicated from ${offer.offerNumber}`,
            createdByUserId: session.id,
          },
          tx
        );

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

      const [total, draft, released, accepted, declined, withdrawn] = await Promise.all([
        prisma.offer.count({ where: scopeWhere }),
        prisma.offer.count({ where: { status: OfferStatus.draft, ...scopeWhere } }),
        prisma.offer.count({ where: { status: OfferStatus.released, ...scopeWhere } }),
        prisma.offer.count({ where: { status: OfferStatus.accepted, ...scopeWhere } }),
        prisma.offer.count({ where: { status: OfferStatus.declined, ...scopeWhere } }),
        prisma.offer.count({ where: { status: OfferStatus.withdrawn, ...scopeWhere } }),
      ]);

      const totalClosed = accepted + declined + withdrawn;
      const acceptanceRate =
        totalClosed > 0 ? parseFloat(((accepted / totalClosed) * 100).toFixed(1)) : 0;

      return {
        total,
        draft,
        released,
        accepted,
        declined,
        withdrawn,
        acceptanceRate,
      };
    },
  };
}
