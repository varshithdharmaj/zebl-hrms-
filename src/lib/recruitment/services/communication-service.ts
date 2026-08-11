import {
  NotificationChannel,
  NotificationType,
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
  RecruitmentTimelineEntityType,
} from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import { canAccessRecruitmentAdministration } from "@/lib/recruitment/permissions/recruitment-test-manager";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { enqueueNotification } from "@/lib/notifications/notification-queue";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import type { CommunicationRepository } from "@/lib/recruitment/repositories/communication-repository";
import { prismaCommunicationRepository } from "@/lib/recruitment/repositories/prisma-communication-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { renderEmailContent } from "@/lib/recruitment/communication/template-renderer";
import {
  createDraftSchema,
  updateDraftSchema,
  sendMessageSchema,
  listCommunicationsSchema,
  searchCommunicationsSchema,
  getThreadSchema,
  uploadCommunicationAttachmentSchema,
  attachmentIdSchema,
  listAttachmentsSchema,
  duplicateDraftSchema,
  type CreateDraftInput,
  type UpdateDraftInput,
  type SendMessageInput,
  type ListCommunicationsInput,
  type SearchCommunicationsInput,
  type UploadCommunicationAttachmentInput,
} from "@/lib/validation/schemas/recruitment/communications";
import { normalizePagination } from "@/lib/recruitment/shared/pagination";
import {
  scanAttachmentForVirus,
  validateCommunicationAttachment,
} from "@/lib/recruitment/communication/attachment-rules";
import { buildCommunicationAttachmentStoragePath } from "@/lib/recruitment/shared/storage-paths";
import { createCommunicationPhase5Methods } from "@/lib/recruitment/services/communication-phase5";

async function assertCanWriteCommunication(session: SessionUser): Promise<RecruitmentScope> {
  RecruitmentPermissionService.requireModuleEnabled();
  const scope = await RecruitmentScopeEngine.getScope(session);

  if (canAccessRecruitmentAdministration(session)) {
    return scope;
  }

  if (!scope.capabilities.isRecruiterOnJob) {
    throw new RecruitmentDomainError(
      "REC_UNAUTHORIZED",
      "Only HR or assigned recruiters can write communications."
    );
  }

  return scope;
}

async function assertCanReadCommunication(session: SessionUser): Promise<RecruitmentScope> {
  RecruitmentPermissionService.requireModuleEnabled();
  const actor = toRecruitmentActor(session);
  return RecruitmentScopeEngine.assertModuleActor(actor);
}

function assertEntityInScope(
  scope: RecruitmentScope,
  refs: {
    candidateId?: string | null;
    applicationId?: string | null;
    jobOpeningId?: string | null;
  }
): void {
  if (scope.mode === "unrestricted") return;

  const hasPrimary = Boolean(
    refs.candidateId || refs.applicationId || refs.jobOpeningId
  );
  if (!hasPrimary) {
    throw new RecruitmentDomainError(
      "REC_FORBIDDEN_SCOPE",
      "Communication is outside recruitment scope."
    );
  }

  if (refs.candidateId) {
    RecruitmentScopeEngine.assertCandidateInScope(scope, refs.candidateId);
  }
  if (refs.applicationId) {
    RecruitmentScopeEngine.assertApplicationInScope(scope, refs.applicationId);
  }
  if (refs.jobOpeningId && !scope.jobOpeningIds.includes(refs.jobOpeningId)) {
    throw new RecruitmentDomainError(
      "REC_FORBIDDEN_SCOPE",
      "Job opening outside recruitment scope."
    );
  }
}

function assertDraftEditable(status: RecruitmentCommunicationStatus): void {
  if (status !== RecruitmentCommunicationStatus.draft) {
    throw new RecruitmentDomainError(
      "REC_PRECONDITION",
      "Only draft communications can be edited or deleted."
    );
  }
}

function assertSendable(status: RecruitmentCommunicationStatus): void {
  if (
    status !== RecruitmentCommunicationStatus.draft &&
    status !== RecruitmentCommunicationStatus.scheduled
  ) {
    throw new RecruitmentDomainError(
      "REC_PRECONDITION",
      "Only draft or scheduled communications can be sent."
    );
  }
}

function resolveThreadId(args: {
  id: string;
  threadId?: string | null;
  parentId?: string | null;
}): string {
  return args.threadId ?? args.parentId ?? args.id;
}

export function createCommunicationService(
  repository: CommunicationRepository = prismaCommunicationRepository
) {
  const phase5 = createCommunicationPhase5Methods(repository);

  return {
    ...phase5,

    async createDraft(session: SessionUser, input: CreateDraftInput) {
      const scope = await assertCanWriteCommunication(session);
      const parsed = createDraftSchema.parse(input);
      assertEntityInScope(scope, parsed);

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();

      const { id } = await withRecruitmentTransaction(async (tx) => {
        const created = await repository.createCommunication(
          {
            type: parsed.type,
            status: RecruitmentCommunicationStatus.draft,
            subject: parsed.subject,
            body: parsed.body,
            candidateId: parsed.candidateId,
            applicationId: parsed.applicationId,
            jobOpeningId: parsed.jobOpeningId,
            interviewId: parsed.interviewId,
            offerId: parsed.offerId,
            templateId: parsed.templateId,
            senderUserId: session.id,
            recipientEmail: parsed.recipientEmail,
            parentId: parsed.parentId,
            threadId: parsed.threadId ?? parsed.parentId ?? null,
            metadata: parsed.metadata,
          },
          tx
        );

        const threadId = resolveThreadId({
          id: created.id,
          threadId: parsed.threadId,
          parentId: parsed.parentId,
        });

        if (!parsed.threadId && !parsed.parentId) {
          await repository.updateCommunication(
            created.id,
            { threadId },
            tx
          );
        }

        if (parsed.candidateId) {
          await RecruitmentTimelineService.append({
            entityType: RecruitmentTimelineEntityType.candidate,
            entityId: parsed.candidateId,
            eventType: "CommunicationDraftCreated",
            summary: `Communication draft created: ${parsed.subject}`,
            actorUserId: session.id,
            candidateId: parsed.candidateId,
            applicationId: parsed.applicationId ?? null,
            jobOpeningId: parsed.jobOpeningId ?? null,
            metadata: { communicationId: created.id, status: "draft" },
          });
        }

        events.enqueue(
          RecruitmentEventFactory.communicationDraftCreated(actor, {
            communicationId: created.id,
            candidateId: parsed.candidateId ?? null,
            applicationId: parsed.applicationId ?? null,
          })
        );

        return created;
      });

      await events.flush();
      await writeAuditLog({
        entityType: "recruitment_communication",
        entityId: id,
        action: AUDIT_ACTIONS.RECRUITMENT_COMMUNICATION_DRAFT_CREATED,
        metadata: {
          candidateId: parsed.candidateId ?? null,
          subject: parsed.subject,
        },
      });

      return { id };
    },

    async updateDraft(session: SessionUser, input: UpdateDraftInput) {
      const scope = await assertCanWriteCommunication(session);
      const parsed = updateDraftSchema.parse(input);

      const existing = await repository.getCommunication(parsed.id);
      if (!existing || existing.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
      }

      assertDraftEditable(existing.status);
      assertEntityInScope(scope, {
        candidateId: parsed.candidateId ?? existing.candidateId,
        applicationId: parsed.applicationId ?? existing.applicationId,
        jobOpeningId: parsed.jobOpeningId ?? existing.jobOpeningId,
      });

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateCommunication(
          parsed.id,
          {
            subject: parsed.subject,
            body: parsed.body,
            candidateId: parsed.candidateId,
            applicationId: parsed.applicationId,
            jobOpeningId: parsed.jobOpeningId,
            interviewId: parsed.interviewId,
            offerId: parsed.offerId,
            templateId: parsed.templateId,
            recipientEmail: parsed.recipientEmail,
            metadata: parsed.metadata,
          },
          tx
        );

        const candidateId = parsed.candidateId ?? existing.candidateId;
        if (candidateId) {
          await RecruitmentTimelineService.append({
            entityType: RecruitmentTimelineEntityType.candidate,
            entityId: candidateId,
            eventType: "CommunicationUpdated",
            summary: `Communication draft updated: ${parsed.subject ?? existing.subject ?? "Untitled"}`,
            actorUserId: session.id,
            candidateId,
            applicationId: parsed.applicationId ?? existing.applicationId,
            jobOpeningId: parsed.jobOpeningId ?? existing.jobOpeningId,
            metadata: { communicationId: parsed.id },
          });
        }

        events.enqueue(
          RecruitmentEventFactory.communicationUpdated(actor, {
            communicationId: parsed.id,
            candidateId: candidateId ?? null,
          })
        );
      });

      await events.flush();
      await writeAuditLog({
        entityType: "recruitment_communication",
        entityId: parsed.id,
        action: AUDIT_ACTIONS.RECRUITMENT_COMMUNICATION_UPDATED,
        metadata: { candidateId: parsed.candidateId ?? existing.candidateId },
      });

      return { id: parsed.id };
    },

    async deleteDraft(session: SessionUser, id: string) {
      const scope = await assertCanWriteCommunication(session);
      const existing = await repository.getCommunication(id);
      if (!existing || existing.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
      }

      assertDraftEditable(existing.status);
      assertEntityInScope(scope, existing);

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();

      await withRecruitmentTransaction(async (tx) => {
        await repository.softDeleteCommunication(id, tx);

        if (existing.candidateId) {
          await RecruitmentTimelineService.append({
            entityType: RecruitmentTimelineEntityType.candidate,
            entityId: existing.candidateId,
            eventType: "CommunicationDeleted",
            summary: `Communication draft deleted: ${existing.subject ?? "Untitled"}`,
            actorUserId: session.id,
            candidateId: existing.candidateId,
            applicationId: existing.applicationId,
            jobOpeningId: existing.jobOpeningId,
            metadata: { communicationId: id },
          });
        }

        events.enqueue(
          RecruitmentEventFactory.communicationDeleted(actor, {
            communicationId: id,
            candidateId: existing.candidateId,
          })
        );
      });

      await events.flush();
      await writeAuditLog({
        entityType: "recruitment_communication",
        entityId: id,
        action: AUDIT_ACTIONS.RECRUITMENT_COMMUNICATION_DELETED,
        metadata: { candidateId: existing.candidateId },
      });

      return { id };
    },

    async sendMessage(session: SessionUser, input: SendMessageInput) {
      const scope = await assertCanWriteCommunication(session);
      const parsed = sendMessageSchema.parse(input);
      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();

      let communicationId = parsed.id;
      let subject = parsed.subject;
      let body = parsed.body;
      let recipientEmail = parsed.recipientEmail;
      let candidateId = parsed.candidateId ?? null;
      let applicationId = parsed.applicationId ?? null;
      let jobOpeningId = parsed.jobOpeningId ?? null;
      let type = parsed.type ?? RecruitmentCommunicationType.email_sent;
      let templateId = parsed.templateId ?? null;
      let threadId = parsed.threadId ?? parsed.parentId ?? null;
      let parentId = parsed.parentId ?? null;
      let metadata = parsed.metadata;

      if (parsed.id) {
        const existing = await repository.getCommunication(parsed.id);
        if (!existing || existing.deletedAt) {
          throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
        }
        assertSendable(existing.status);
        assertEntityInScope(scope, {
          candidateId: parsed.candidateId ?? existing.candidateId,
          applicationId: parsed.applicationId ?? existing.applicationId,
          jobOpeningId: parsed.jobOpeningId ?? existing.jobOpeningId,
        });

        subject = parsed.subject ?? existing.subject ?? undefined;
        body = parsed.body ?? existing.body ?? undefined;
        recipientEmail = parsed.recipientEmail ?? existing.recipientEmail;
        candidateId = parsed.candidateId ?? existing.candidateId;
        applicationId = parsed.applicationId ?? existing.applicationId;
        jobOpeningId = parsed.jobOpeningId ?? existing.jobOpeningId;
        type = existing.type;
        templateId = parsed.templateId ?? existing.templateId;
        threadId = existing.threadId ?? existing.id;
        parentId = existing.parentId;
        metadata =
          parsed.metadata ??
          (typeof existing.metadata === "object" && existing.metadata !== null
            ? (existing.metadata as Record<string, unknown>)
            : undefined);
      } else {
        assertEntityInScope(scope, {
          candidateId,
          applicationId,
          jobOpeningId,
        });
      }

      if (!subject?.trim() || !body?.trim()) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Subject and body are required to send a message."
        );
      }

      if (!recipientEmail?.trim()) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Recipient email is required to send a message."
        );
      }

      if (templateId && parsed.templateVariables) {
        const template = await repository.getTemplate(templateId);
        if (template) {
          const rendered = renderEmailContent(
            subject,
            body,
            parsed.templateVariables as Record<string, string | undefined>
          );
          subject = rendered.subject;
          body = rendered.body;
        }
      } else if (parsed.templateVariables) {
        const rendered = renderEmailContent(
          subject,
          body,
          parsed.templateVariables as Record<string, string | undefined>
        );
        subject = rendered.subject;
        body = rendered.body;
      }

      const sentAt = new Date();

      const result = await withRecruitmentTransaction(async (tx) => {
        if (!communicationId) {
          const created = await repository.createCommunication(
            {
              type,
              status: RecruitmentCommunicationStatus.sent,
              subject,
              body,
              candidateId,
              applicationId,
              jobOpeningId,
              interviewId: parsed.interviewId,
              offerId: parsed.offerId,
              templateId,
              senderUserId: session.id,
              recipientEmail,
              parentId,
              threadId,
              metadata,
              scheduledFor: null,
            },
            tx
          );
          communicationId = created.id;
          const resolvedThread = resolveThreadId({
            id: created.id,
            threadId,
            parentId,
          });
          await repository.updateCommunication(
            created.id,
            {
              status: RecruitmentCommunicationStatus.sent,
              sentAt,
              threadId: resolvedThread,
              subject,
              body,
            },
            tx
          );
          threadId = resolvedThread;
        } else {
          const resolvedThread = resolveThreadId({
            id: communicationId,
            threadId,
            parentId,
          });
          await repository.updateCommunication(
            communicationId,
            {
              status: RecruitmentCommunicationStatus.sent,
              sentAt,
              subject,
              body,
              recipientEmail,
              candidateId,
              applicationId,
              jobOpeningId,
              templateId,
              threadId: resolvedThread,
              metadata,
            },
            tx
          );
          threadId = resolvedThread;
        }

        if (candidateId) {
          await RecruitmentTimelineService.append({
            entityType: RecruitmentTimelineEntityType.candidate,
            entityId: candidateId,
            eventType: "CommunicationSent",
            summary: `Email sent: ${subject}`,
            actorUserId: session.id,
            candidateId,
            applicationId,
            jobOpeningId,
            metadata: {
              communicationId,
              recipientEmail,
              type,
            },
          });
        }

        events.enqueue(
          RecruitmentEventFactory.communicationSent(actor, {
            communicationId: communicationId!,
            candidateId,
            applicationId,
            recipientEmail,
          })
        );

        return { id: communicationId! };
      });

      await events.flush();

      await enqueueNotification({
        type: NotificationType.recruitment_mention,
        channel: NotificationChannel.email,
        recipient: recipientEmail,
        subject: subject!,
        payload: {
          communicationId: result.id,
          candidateId,
          applicationId,
          body,
          senderUserId: session.id,
        },
        correlationId: result.id,
      });

      if (session.email && session.email !== recipientEmail) {
        await enqueueNotification({
          type: NotificationType.recruitment_mention,
          channel: NotificationChannel.email,
          recipient: session.email,
          subject: `Sent: ${subject}`,
          payload: {
            communicationId: result.id,
            candidateId,
            applicationId,
            recipientEmail,
          },
          correlationId: `${result.id}:sender`,
          userId: session.id,
        });
      }

      await writeAuditLog({
        entityType: "recruitment_communication",
        entityId: result.id,
        action: AUDIT_ACTIONS.RECRUITMENT_COMMUNICATION_SENT,
        metadata: {
          candidateId,
          recipientEmail,
          subject,
        },
      });

      return result;
    },

    async getCommunication(session: SessionUser, id: string) {
      const scope = await assertCanReadCommunication(session);
      const row = await repository.getCommunication(id);
      if (!row || row.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
      }
      assertEntityInScope(scope, row);
      return row;
    },

    async listCommunications(session: SessionUser, input: ListCommunicationsInput = {}) {
      const scope = await assertCanReadCommunication(session);
      const parsed = listCommunicationsSchema.parse(input);
      const pagination = normalizePagination({
        page: parsed.page,
        pageSize: parsed.pageSize,
      });

      if (parsed.candidateId || parsed.applicationId || parsed.jobOpeningId) {
        assertEntityInScope(scope, parsed);
      }

      return repository.listCommunications({
        scope,
        filters: {
          candidateId: parsed.candidateId,
          applicationId: parsed.applicationId,
          jobOpeningId: parsed.jobOpeningId,
          interviewId: parsed.interviewId,
          offerId: parsed.offerId,
          type: parsed.type,
          status: parsed.status,
          senderUserId: parsed.senderUserId,
          threadId: parsed.threadId,
          search: parsed.search,
        },
        pagination,
      });
    },

    async searchCommunications(
      session: SessionUser,
      input: SearchCommunicationsInput
    ) {
      const scope = await assertCanReadCommunication(session);
      const parsed = searchCommunicationsSchema.parse(input);
      const pagination = normalizePagination({
        page: parsed.page,
        pageSize: parsed.pageSize,
      });

      return repository.searchCommunications({
        scope,
        query: parsed.query,
        filters: {
          candidateId: parsed.candidateId,
          applicationId: parsed.applicationId,
          jobOpeningId: parsed.jobOpeningId,
          type: parsed.type,
          status: parsed.status,
        },
        pagination,
      });
    },

    async getThread(session: SessionUser, threadId: string) {
      const scope = await assertCanReadCommunication(session);
      const parsed = getThreadSchema.parse({ threadId });
      return repository.getCommunicationThread(parsed.threadId, scope);
    },

    async getDashboardStats(session: SessionUser) {
      const extended = await phase5.getExtendedDashboardStats(session);
      return {
        drafts: extended.drafts,
        sent: extended.sent,
        failed: extended.failed,
        scheduled: extended.scheduled,
        unread: extended.unread,
        expiredScheduled: extended.expiredScheduled,
        recent: extended.recent,
      };
    },

    renderTemplateContent(
      subject: string,
      body: string,
      variables: Record<string, string>
    ) {
      return renderEmailContent(subject, body, variables);
    },

    async listEmailTemplates(session: SessionUser) {
      await assertCanReadCommunication(session);
      return repository.listTemplates({ isActive: true });
    },

    async getEmailTemplate(session: SessionUser, id: string) {
      await assertCanReadCommunication(session);
      const template = await repository.getTemplate(id);
      if (!template || template.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Email template not found.");
      }
      return template;
    },

    async duplicateDraft(session: SessionUser, id: string) {
      const scope = await assertCanWriteCommunication(session);
      const parsed = duplicateDraftSchema.parse({ id });
      const source = await repository.getCommunication(parsed.id);
      if (!source || source.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
      }
      assertEntityInScope(scope, source);

      return this.createDraft(session, {
        type: source.type,
        subject: source.subject ? `Copy: ${source.subject}` : "Copy",
        body: source.body ?? "",
        candidateId: source.candidateId,
        applicationId: source.applicationId,
        jobOpeningId: source.jobOpeningId,
        interviewId: source.interviewId,
        offerId: source.offerId,
        templateId: source.templateId,
        recipientEmail: source.recipientEmail,
        metadata:
          typeof source.metadata === "object" && source.metadata !== null
            ? { ...(source.metadata as Record<string, unknown>), duplicatedFrom: source.id }
            : { duplicatedFrom: source.id },
      });
    },

    async addAttachment(session: SessionUser, input: UploadCommunicationAttachmentInput) {
      const scope = await assertCanWriteCommunication(session);
      const parsed = uploadCommunicationAttachmentSchema.parse(input);

      const validation = validateCommunicationAttachment({
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        fileSize: parsed.fileSize,
      });
      if (!validation.ok) {
        throw new RecruitmentDomainError("REC_VALIDATION", validation.message);
      }

      const scan = await scanAttachmentForVirus({
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        fileSize: parsed.fileSize,
        storagePath: parsed.storagePath,
      });
      if (!scan.ok) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          scan.reason || "Attachment failed virus scan."
        );
      }

      const communication = await repository.getCommunication(parsed.communicationId);
      if (!communication || communication.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
      }
      assertEntityInScope(scope, communication);
      assertDraftEditable(communication.status);

      const storagePath = buildCommunicationAttachmentStoragePath(
        parsed.communicationId,
        parsed.fileName
      );

      const created = await repository.addAttachment(parsed.communicationId, {
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        fileSize: parsed.fileSize,
        storagePath,
      });

      await writeAuditLog({
        entityType: "recruitment_communication",
        entityId: parsed.communicationId,
        action: AUDIT_ACTIONS.RECRUITMENT_COMMUNICATION_ATTACHMENT_ADDED,
        metadata: {
          attachmentId: created.id,
          fileName: parsed.fileName,
          fileSize: parsed.fileSize,
          candidateId: communication.candidateId,
        },
      });

      return { id: created.id, candidateId: communication.candidateId };
    },

    async listAttachments(session: SessionUser, communicationId: string) {
      const scope = await assertCanReadCommunication(session);
      const parsed = listAttachmentsSchema.parse({ communicationId });
      const communication = await repository.getCommunication(parsed.communicationId);
      if (!communication || communication.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
      }
      assertEntityInScope(scope, communication);
      return repository.getAttachments(parsed.communicationId);
    },

    async getAttachment(session: SessionUser, id: string) {
      const scope = await assertCanReadCommunication(session);
      const parsed = attachmentIdSchema.parse({ id });
      const attachment = await repository.getAttachment(parsed.id);
      if (!attachment) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Attachment not found.");
      }
      const communication = await repository.getCommunication(attachment.communicationId);
      if (!communication || communication.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
      }
      assertEntityInScope(scope, communication);
      return { attachment, communication };
    },

    async removeAttachment(session: SessionUser, id: string) {
      const scope = await assertCanWriteCommunication(session);
      const parsed = attachmentIdSchema.parse({ id });
      const attachment = await repository.getAttachment(parsed.id);
      if (!attachment) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Attachment not found.");
      }

      const communication = await repository.getCommunication(attachment.communicationId);
      if (!communication || communication.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
      }
      assertEntityInScope(scope, communication);
      assertDraftEditable(communication.status);

      await repository.deleteAttachment(parsed.id);

      await writeAuditLog({
        entityType: "recruitment_communication",
        entityId: communication.id,
        action: AUDIT_ACTIONS.RECRUITMENT_COMMUNICATION_ATTACHMENT_REMOVED,
        metadata: {
          attachmentId: parsed.id,
          fileName: attachment.fileName,
          candidateId: communication.candidateId,
        },
      });

      return { id: parsed.id, candidateId: communication.candidateId };
    },
  };
}

export type CommunicationService = ReturnType<typeof createCommunicationService>;
