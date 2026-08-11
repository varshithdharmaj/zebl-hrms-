import {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
  RecruitmentEmailTemplateType,
} from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import { canAccessRecruitmentAdministration } from "@/lib/recruitment/permissions/recruitment-test-manager";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type { CommunicationRepository } from "@/lib/recruitment/repositories/communication-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { renderEmailContent } from "@/lib/recruitment/communication/template-renderer";
import {
  SYSTEM_EMAIL_TEMPLATES,
  isSystemTemplateId,
  findSystemTemplate,
} from "@/lib/recruitment/communication/system-templates";
import {
  getDefaultEmailTemplateMap,
  setDefaultEmailTemplate,
} from "@/lib/recruitment/communication/default-template-store";
import {
  createTemplateSchema,
  updateTemplateSchema,
  templateIdSchema,
  listTemplatesAdminSchema,
  setDefaultTemplateSchema,
  testRenderTemplateSchema,
  scheduleMessageSchema,
  rescheduleMessageSchema,
  cancelScheduleSchema,
  type CreateTemplateInput,
  type ListTemplatesAdminInput,
  type ScheduleMessageInput,
} from "@/lib/validation/schemas/recruitment/communications";
import { normalizePagination } from "@/lib/recruitment/shared/pagination";

async function assertCanManageTemplates(session: SessionUser) {
  RecruitmentPermissionService.requireModuleEnabled();
  if (!canAccessRecruitmentAdministration(session)) {
    throw new RecruitmentDomainError(
      "REC_UNAUTHORIZED",
      "Only HR or Super Admin can manage email templates."
    );
  }
  return RecruitmentScopeEngine.getScope(session);
}

async function assertCanWrite(session: SessionUser) {
  RecruitmentPermissionService.requireModuleEnabled();
  const scope = await RecruitmentScopeEngine.getScope(session);
  if (canAccessRecruitmentAdministration(session)) return scope;
  if (!scope.capabilities.isRecruiterOnJob) {
    throw new RecruitmentDomainError(
      "REC_UNAUTHORIZED",
      "Only HR or assigned recruiters can schedule communications."
    );
  }
  return scope;
}

async function assertCanRead(session: SessionUser) {
  RecruitmentPermissionService.requireModuleEnabled();
  const actor = toRecruitmentActor(session);
  return RecruitmentScopeEngine.assertModuleActor(actor);
}

function assertEntityInScope(
  scope: Awaited<ReturnType<typeof RecruitmentScopeEngine.getScope>>,
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

function parseScheduleDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RecruitmentDomainError("REC_VALIDATION", "Invalid schedule date.");
  }
  return date;
}

export type AdminTemplateView = {
  id: string;
  name: string;
  type: RecruitmentEmailTemplateType;
  subject: string;
  body: string;
  isSystem: boolean;
  isActive: boolean;
  isDefault: boolean;
  isVirtual: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type CommunicationAnalytics = {
  emailsSent: number;
  emailsDelivered: number;
  openRatePlaceholder: number | null;
  replies: number;
  draftCount: number;
  scheduledCount: number;
  expiredScheduledCount: number;
  failedCount: number;
  templateUsage: Array<{ templateId: string; templateName: string; count: number }>;
  messagesByRecruiter: Array<{
    senderUserId: string;
    senderEmail: string | null;
    count: number;
  }>;
};

export function createCommunicationPhase5Methods(
  repository: CommunicationRepository
) {
  return {
    async listTemplatesAdmin(
      session: SessionUser,
      input: Partial<ListTemplatesAdminInput> = {}
    ) {
      await assertCanRead(session);
      const parsed = listTemplatesAdminSchema.parse(input);
      const defaults = await getDefaultEmailTemplateMap();

      const dbTemplates = await repository.listTemplates({
        type: parsed.type,
        isActive: parsed.tab === "active",
        search: parsed.search,
      });

      const views: AdminTemplateView[] = dbTemplates.map((template) => ({
        id: template.id,
        name: template.name,
        type: template.type,
        subject: template.subject,
        body: template.body,
        isSystem: template.isSystem,
        isActive: template.isActive,
        isDefault: defaults[template.type] === template.id,
        isVirtual: false,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      }));

      if (parsed.tab === "active" && parsed.includeSystem !== false) {
        const search = parsed.search?.trim().toLowerCase() ?? "";
        for (const system of SYSTEM_EMAIL_TEMPLATES) {
          if (parsed.type && system.type !== parsed.type) continue;
          if (
            search &&
            !system.name.toLowerCase().includes(search) &&
            !system.subject.toLowerCase().includes(search)
          ) {
            continue;
          }
          views.push({
            id: system.id,
            name: system.name,
            type: system.type,
            subject: system.subject,
            body: system.body,
            isSystem: true,
            isActive: true,
            isDefault: false,
            isVirtual: true,
            createdAt: null,
            updatedAt: null,
          });
        }
      }

      return views.sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    },

    async createEmailTemplate(session: SessionUser, input: CreateTemplateInput) {
      await assertCanManageTemplates(session);
      const parsed = createTemplateSchema.parse(input);
      const created = await repository.createTemplate({
        ...parsed,
        isSystem: false,
        createdByUserId: session.id,
      });
      await writeAuditLog({
        entityType: "recruitment_email_template",
        entityId: created.id,
        action: AUDIT_ACTIONS.RECRUITMENT_TEMPLATE_CREATED,
        metadata: { name: parsed.name, type: parsed.type },
      });
      return created;
    },

    async updateEmailTemplate(
      session: SessionUser,
      input: {
        id: string;
        name?: string;
        type?: RecruitmentEmailTemplateType;
        subject?: string;
        body?: string;
        isActive?: boolean;
      }
    ) {
      await assertCanManageTemplates(session);
      const parsed = updateTemplateSchema.parse(input);
      if (isSystemTemplateId(parsed.id)) {
        throw new RecruitmentDomainError(
          "REC_PRECONDITION",
          "Built-in system templates cannot be edited. Duplicate to customize."
        );
      }
      const existing = await repository.getTemplate(parsed.id);
      if (!existing) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Email template not found.");
      }
      if (existing.isSystem) {
        throw new RecruitmentDomainError(
          "REC_PRECONDITION",
          "System templates cannot be edited. Duplicate to customize."
        );
      }
      await repository.updateTemplate(parsed.id, {
        name: parsed.name,
        type: parsed.type,
        subject: parsed.subject,
        body: parsed.body,
        isActive: parsed.isActive,
      });
      await writeAuditLog({
        entityType: "recruitment_email_template",
        entityId: parsed.id,
        action: AUDIT_ACTIONS.RECRUITMENT_TEMPLATE_UPDATED,
        metadata: { name: parsed.name ?? existing.name },
      });
      return { id: parsed.id };
    },

    async duplicateEmailTemplate(session: SessionUser, id: string) {
      await assertCanManageTemplates(session);
      const parsed = templateIdSchema.parse({ id });

      if (isSystemTemplateId(parsed.id)) {
        const system = findSystemTemplate(parsed.id);
        if (!system) {
          throw new RecruitmentDomainError("REC_NOT_FOUND", "System template not found.");
        }
        return repository.createTemplate({
          name: `${system.name} (Copy)`,
          type: system.type,
          subject: system.subject,
          body: system.body,
          isSystem: false,
          isActive: true,
          createdByUserId: session.id,
        });
      }

      const source = await repository.getTemplate(parsed.id);
      if (!source) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Email template not found.");
      }
      return repository.createTemplate({
        name: `${source.name} (Copy)`,
        type: source.type,
        subject: source.subject,
        body: source.body,
        isSystem: false,
        isActive: true,
        createdByUserId: session.id,
      });
    },

    async archiveEmailTemplate(session: SessionUser, id: string) {
      await assertCanManageTemplates(session);
      const parsed = templateIdSchema.parse({ id });
      if (isSystemTemplateId(parsed.id)) {
        throw new RecruitmentDomainError(
          "REC_PRECONDITION",
          "System templates cannot be archived."
        );
      }
      const existing = await repository.getTemplate(parsed.id);
      if (!existing) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Email template not found.");
      }
      if (existing.isSystem) {
        throw new RecruitmentDomainError(
          "REC_PRECONDITION",
          "System templates cannot be archived."
        );
      }
      await repository.updateTemplate(parsed.id, { isActive: false });
      return { id: parsed.id };
    },

    async restoreEmailTemplate(session: SessionUser, id: string) {
      await assertCanManageTemplates(session);
      const parsed = templateIdSchema.parse({ id });
      if (isSystemTemplateId(parsed.id)) {
        throw new RecruitmentDomainError(
          "REC_PRECONDITION",
          "System templates cannot be restored."
        );
      }
      // Restore archived (inactive) or soft-deleted custom templates.
      await repository.restoreTemplate(parsed.id);
      await repository.updateTemplate(parsed.id, { isActive: true });
      return { id: parsed.id };
    },

    async deleteEmailTemplate(session: SessionUser, id: string) {
      await assertCanManageTemplates(session);
      const parsed = templateIdSchema.parse({ id });
      if (isSystemTemplateId(parsed.id)) {
        throw new RecruitmentDomainError(
          "REC_PRECONDITION",
          "System templates cannot be deleted."
        );
      }
      const existing = await repository.getTemplate(parsed.id);
      if (!existing) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Email template not found.");
      }
      if (existing.isSystem) {
        throw new RecruitmentDomainError(
          "REC_PRECONDITION",
          "System templates cannot be deleted."
        );
      }
      await repository.softDeleteTemplate(parsed.id);
      await writeAuditLog({
        entityType: "recruitment_email_template",
        entityId: parsed.id,
        action: AUDIT_ACTIONS.RECRUITMENT_TEMPLATE_DELETED,
        metadata: { name: existing.name },
      });
      return { id: parsed.id };
    },

    async setDefaultEmailTemplate(
      session: SessionUser,
      input: { id: string; type: RecruitmentEmailTemplateType }
    ) {
      await assertCanManageTemplates(session);
      const parsed = setDefaultTemplateSchema.parse(input);
      if (isSystemTemplateId(parsed.id)) {
        await setDefaultEmailTemplate(parsed.type, null);
        return { id: parsed.id, type: parsed.type, isDefault: false };
      }
      const existing = await repository.getTemplate(parsed.id);
      if (!existing || !existing.isActive) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Email template not found.");
      }
      await setDefaultEmailTemplate(parsed.type, parsed.id);
      return { id: parsed.id, type: parsed.type, isDefault: true };
    },

    testRenderTemplate(
      session: SessionUser,
      input: { subject: string; body: string; variables?: Record<string, string> }
    ) {
      RecruitmentPermissionService.requireModuleEnabled();
      const parsed = testRenderTemplateSchema.parse(input);
      return renderEmailContent(parsed.subject, parsed.body, parsed.variables ?? {});
    },

    async scheduleMessage(session: SessionUser, input: ScheduleMessageInput) {
      const scope = await assertCanWrite(session);
      const parsed = scheduleMessageSchema.parse(input);
      const scheduledFor = parseScheduleDate(parsed.scheduledFor);
      if (scheduledFor.getTime() <= Date.now()) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Schedule time must be in the future."
        );
      }

      if (parsed.id) {
        const existing = await repository.getCommunication(parsed.id);
        if (!existing || existing.deletedAt) {
          throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
        }
        if (
          existing.status !== RecruitmentCommunicationStatus.draft &&
          existing.status !== RecruitmentCommunicationStatus.scheduled
        ) {
          throw new RecruitmentDomainError(
            "REC_PRECONDITION",
            "Only draft or scheduled messages can be scheduled."
          );
        }
        assertEntityInScope(scope, existing);
        await repository.updateCommunication(parsed.id, {
          status: RecruitmentCommunicationStatus.scheduled,
          scheduledFor,
          subject: parsed.subject ?? existing.subject,
          body: parsed.body ?? existing.body,
          recipientEmail: parsed.recipientEmail ?? existing.recipientEmail,
        });
        await writeAuditLog({
          entityType: "recruitment_communication",
          entityId: parsed.id,
          action: AUDIT_ACTIONS.RECRUITMENT_COMMUNICATION_SCHEDULED,
          metadata: { scheduledFor: scheduledFor.toISOString() },
        });
        return { id: parsed.id, scheduledFor };
      }

      assertEntityInScope(scope, parsed);
      if (!parsed.subject?.trim() || !parsed.body?.trim()) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Subject and body are required to schedule a message."
        );
      }
      if (!parsed.recipientEmail?.trim()) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Recipient email is required to schedule a message."
        );
      }

      const created = await repository.createCommunication({
        type: parsed.type ?? RecruitmentCommunicationType.email_sent,
        status: RecruitmentCommunicationStatus.scheduled,
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
        scheduledFor,
        metadata: parsed.metadata,
      });
      await repository.updateCommunication(created.id, { threadId: created.id });
      await writeAuditLog({
        entityType: "recruitment_communication",
        entityId: created.id,
        action: AUDIT_ACTIONS.RECRUITMENT_COMMUNICATION_SCHEDULED,
        metadata: { scheduledFor: scheduledFor.toISOString() },
      });
      return { id: created.id, scheduledFor };
    },

    async rescheduleMessage(
      session: SessionUser,
      input: { id: string; scheduledFor: string }
    ) {
      const scope = await assertCanWrite(session);
      const parsed = rescheduleMessageSchema.parse(input);
      const scheduledFor = parseScheduleDate(parsed.scheduledFor);
      if (scheduledFor.getTime() <= Date.now()) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Schedule time must be in the future."
        );
      }
      const existing = await repository.getCommunication(parsed.id);
      if (!existing || existing.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
      }
      if (existing.status !== RecruitmentCommunicationStatus.scheduled) {
        throw new RecruitmentDomainError(
          "REC_PRECONDITION",
          "Only scheduled messages can be rescheduled."
        );
      }
      assertEntityInScope(scope, existing);
      await repository.updateCommunication(parsed.id, { scheduledFor });
      return { id: parsed.id, scheduledFor };
    },

    async cancelSchedule(session: SessionUser, id: string) {
      const scope = await assertCanWrite(session);
      const parsed = cancelScheduleSchema.parse({ id });
      const existing = await repository.getCommunication(parsed.id);
      if (!existing || existing.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Communication not found.");
      }
      if (existing.status !== RecruitmentCommunicationStatus.scheduled) {
        throw new RecruitmentDomainError(
          "REC_PRECONDITION",
          "Only scheduled messages can be cancelled."
        );
      }
      assertEntityInScope(scope, existing);
      await repository.updateCommunication(parsed.id, {
        status: RecruitmentCommunicationStatus.draft,
        scheduledFor: null,
      });
      await writeAuditLog({
        entityType: "recruitment_communication",
        entityId: parsed.id,
        action: AUDIT_ACTIONS.RECRUITMENT_COMMUNICATION_SCHEDULE_CANCELLED,
        metadata: {},
      });
      return { id: parsed.id };
    },

    async listScheduledQueue(
      session: SessionUser,
      input: { page?: number; pageSize?: number; candidateId?: string } = {}
    ) {
      const scope = await assertCanRead(session);
      const pagination = normalizePagination({
        page: input.page,
        pageSize: input.pageSize,
      });
      const result = await repository.listCommunications({
        scope,
        filters: {
          status: RecruitmentCommunicationStatus.scheduled,
          candidateId: input.candidateId,
        },
        pagination,
      });
      const now = Date.now();
      return {
        ...result,
        items: result.items.map((item) => ({
          ...item,
          isExpired: Boolean(
            item.scheduledFor && item.scheduledFor.getTime() < now
          ),
        })),
      };
    },

    async getExtendedDashboardStats(session: SessionUser) {
      const scope = await assertCanRead(session);
      const [
        drafts,
        sent,
        failed,
        scheduled,
        inbox,
        recent,
      ] = await Promise.all([
        repository.countDraftsByUser(session.id, scope),
        repository.countByStatus(RecruitmentCommunicationStatus.sent, scope),
        repository.countByStatus(RecruitmentCommunicationStatus.failed, scope),
        repository.countByStatus(RecruitmentCommunicationStatus.scheduled, scope),
        repository.listCommunications({
          scope,
          filters: { type: RecruitmentCommunicationType.email_received },
          pagination: { page: 1, pageSize: 100 },
        }),
        repository.listCommunications({
          scope,
          filters: {},
          pagination: { page: 1, pageSize: 8 },
        }),
      ]);

      const unread = inbox.items.filter((item) => {
        if (!item.metadata || typeof item.metadata !== "object") return true;
        return (item.metadata as Record<string, unknown>).read !== true;
      }).length;

      const now = Date.now();
      const scheduledList = await repository.listCommunications({
        scope,
        filters: { status: RecruitmentCommunicationStatus.scheduled },
        pagination: { page: 1, pageSize: 100 },
      });
      const expiredScheduled = scheduledList.items.filter(
        (item) => item.scheduledFor && item.scheduledFor.getTime() < now
      ).length;

      return {
        drafts,
        sent,
        failed,
        scheduled,
        unread,
        expiredScheduled,
        recent: recent.items,
      };
    },

    async getCommunicationAnalytics(session: SessionUser): Promise<CommunicationAnalytics> {
      const scope = await assertCanRead(session);

      const [sent, delivered, drafts, scheduled, failed, received, withTemplate] =
        await Promise.all([
          repository.countByStatus(RecruitmentCommunicationStatus.sent, scope),
          repository.countByStatus(RecruitmentCommunicationStatus.delivered, scope),
          repository.countByStatus(RecruitmentCommunicationStatus.draft, scope),
          repository.countByStatus(RecruitmentCommunicationStatus.scheduled, scope),
          repository.countByStatus(RecruitmentCommunicationStatus.failed, scope),
          repository.listCommunications({
            scope,
            filters: { type: RecruitmentCommunicationType.email_received },
            pagination: { page: 1, pageSize: 1 },
          }),
          repository.listCommunications({
            scope,
            filters: { status: RecruitmentCommunicationStatus.sent },
            pagination: { page: 1, pageSize: 200 },
          }),
        ]);

      const now = Date.now();
      const scheduledRows = await repository.listCommunications({
        scope,
        filters: { status: RecruitmentCommunicationStatus.scheduled },
        pagination: { page: 1, pageSize: 200 },
      });
      const expiredScheduledCount = scheduledRows.items.filter(
        (item) => item.scheduledFor && item.scheduledFor.getTime() < now
      ).length;

      const templateCounts = new Map<string, { name: string; count: number }>();
      const recruiterCounts = new Map<string, { email: string | null; count: number }>();

      for (const item of withTemplate.items) {
        if (item.templateId) {
          const current = templateCounts.get(item.templateId) ?? {
            name: item.template?.name ?? "Unknown template",
            count: 0,
          };
          current.count += 1;
          templateCounts.set(item.templateId, current);
        }
        if (item.senderUserId) {
          const current = recruiterCounts.get(item.senderUserId) ?? {
            email: item.sender?.email ?? null,
            count: 0,
          };
          current.count += 1;
          recruiterCounts.set(item.senderUserId, current);
        }
      }

      // Open rate is a placeholder until email provider webhooks exist.
      void prisma;

      return {
        emailsSent: sent + delivered,
        emailsDelivered: delivered,
        openRatePlaceholder: null,
        replies: received.total,
        draftCount: drafts,
        scheduledCount: scheduled,
        expiredScheduledCount,
        failedCount: failed,
        templateUsage: [...templateCounts.entries()]
          .map(([templateId, value]) => ({
            templateId,
            templateName: value.name,
            count: value.count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        messagesByRecruiter: [...recruiterCounts.entries()]
          .map(([senderUserId, value]) => ({
            senderUserId,
            senderEmail: value.email,
            count: value.count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      };
    },
  };
}

export type CommunicationPhase5Methods = ReturnType<
  typeof createCommunicationPhase5Methods
>;
