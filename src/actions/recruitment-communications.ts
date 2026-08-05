"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  createDraftSchema,
  updateDraftSchema,
  deleteDraftSchema,
  sendMessageSchema,
  listCommunicationsSchema,
  searchCommunicationsSchema,
  getThreadSchema,
  communicationIdSchema,
  uploadCommunicationAttachmentSchema,
  attachmentIdSchema,
  listAttachmentsSchema,
  duplicateDraftSchema,
  createTemplateSchema,
  updateTemplateSchema,
  templateIdSchema,
  listTemplatesAdminSchema,
  setDefaultTemplateSchema,
  testRenderTemplateSchema,
  scheduleMessageSchema,
  rescheduleMessageSchema,
  cancelScheduleSchema,
} from "@/lib/validation/schemas/recruitment/communications";
import { createCommunicationService } from "@/lib/recruitment/services/communication-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentCommunicationActionState = ActionState & {
  communicationId?: string;
  attachmentId?: string;
  templateId?: string;
};

function revalidateTemplates() {
  revalidatePath("/admin/recruitment/communications/templates");
  revalidatePath("/admin/recruitment/communications/new");
  revalidatePath("/admin/recruitment/analytics");
  revalidatePath("/admin/recruitment");
}

function revalidateCommunicationList() {
  revalidatePath("/admin/recruitment/communications");
}

function revalidateCommunicationDraft(id?: string) {
  if (id) {
    revalidatePath(`/admin/recruitment/communications/drafts/${id}`);
  }
  revalidatePath("/admin/recruitment/communications/new");
}

function revalidateCandidateDetail(candidateId?: string | null) {
  if (candidateId) {
    revalidatePath(`/admin/recruitment/candidates/${candidateId}`);
  }
}

function revalidateRecruitmentDashboard() {
  revalidatePath("/admin/recruitment");
}

export async function createDraftAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(createDraftSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const { id } = await service.createDraft(session, parsed.data);

    revalidateCommunicationList();
    revalidateCommunicationDraft(id);
    revalidateCandidateDetail(parsed.data.candidateId);
    revalidateRecruitmentDashboard();

    return { success: "Draft created successfully.", communicationId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function updateDraftAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(updateDraftSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const { id } = await service.updateDraft(session, parsed.data);

    revalidateCommunicationList();
    revalidateCommunicationDraft(id);
    revalidateCandidateDetail(parsed.data.candidateId);
    revalidateRecruitmentDashboard();

    return { success: "Draft updated successfully.", communicationId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function deleteDraftAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(deleteDraftSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const existing = await service.getCommunication(session, parsed.data.id);
    await service.deleteDraft(session, parsed.data.id);

    revalidateCommunicationList();
    revalidateCandidateDetail(existing.candidateId);
    revalidateRecruitmentDashboard();

    return { success: "Draft deleted successfully.", communicationId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function sendMessageAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(sendMessageSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const { id } = await service.sendMessage(session, parsed.data);

    revalidateCommunicationList();
    revalidateCandidateDetail(parsed.data.candidateId);
    revalidateRecruitmentDashboard();

    return { success: "Message sent successfully.", communicationId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function listCommunicationsAction(
  input: unknown
): Promise<ActionState & { data?: unknown }> {
  try {
    const parsed = safeParseWithSchema(listCommunicationsSchema, input ?? {});
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const data = await service.listCommunications(session, parsed.data);
    return { success: "OK", data };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function searchCommunicationsAction(
  input: unknown
): Promise<ActionState & { data?: unknown }> {
  try {
    const parsed = safeParseWithSchema(searchCommunicationsSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const data = await service.searchCommunications(session, parsed.data);
    return { success: "OK", data };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function getThreadAction(
  input: unknown
): Promise<ActionState & { data?: unknown }> {
  try {
    const parsed = safeParseWithSchema(getThreadSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const data = await service.getThread(session, parsed.data.threadId);
    return { success: "OK", data };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function getCommunicationAction(
  input: unknown
): Promise<ActionState & { data?: unknown }> {
  try {
    const parsed = safeParseWithSchema(communicationIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const data = await service.getCommunication(session, parsed.data.id);
    return { success: "OK", data };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function listEmailTemplatesAction(): Promise<
  ActionState & { data?: unknown }
> {
  try {
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const data = await service.listEmailTemplates(session);
    return { success: "OK", data };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function duplicateDraftAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(duplicateDraftSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const source = await service.getCommunication(session, parsed.data.id);
    const { id } = await service.duplicateDraft(session, parsed.data.id);

    revalidateCommunicationList();
    revalidateCommunicationDraft(id);
    revalidateCandidateDetail(source.candidateId);
    revalidateRecruitmentDashboard();

    return { success: "Draft duplicated successfully.", communicationId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function uploadCommunicationAttachmentAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(uploadCommunicationAttachmentSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const result = await service.addAttachment(session, parsed.data);

    revalidateCommunicationList();
    revalidateCommunicationDraft(parsed.data.communicationId);
    revalidateCandidateDetail(result.candidateId);

    return {
      success: "Attachment uploaded successfully.",
      communicationId: parsed.data.communicationId,
      attachmentId: result.id,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function removeCommunicationAttachmentAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(attachmentIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const result = await service.removeAttachment(session, parsed.data.id);

    revalidateCommunicationList();
    revalidateCandidateDetail(result.candidateId);

    return {
      success: "Attachment removed successfully.",
      attachmentId: result.id,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function listCommunicationAttachmentsAction(
  input: unknown
): Promise<ActionState & { data?: unknown }> {
  try {
    const parsed = safeParseWithSchema(listAttachmentsSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const data = await service.listAttachments(session, parsed.data.communicationId);
    return { success: "OK", data };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function getCommunicationAttachmentAction(
  input: unknown
): Promise<ActionState & { data?: unknown }> {
  try {
    const parsed = safeParseWithSchema(attachmentIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCommunicationService();
    const data = await service.getAttachment(session, parsed.data.id);
    return { success: "OK", data };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function listTemplatesAdminAction(
  input: unknown = {}
): Promise<ActionState & { data?: unknown }> {
  try {
    const parsed = safeParseWithSchema(listTemplatesAdminSchema, input ?? {});
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const data = await service.listTemplatesAdmin(session, parsed.data);
    return { success: "OK", data };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function createEmailTemplateAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(createTemplateSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const { id } = await service.createEmailTemplate(session, parsed.data);
    revalidateTemplates();
    return { success: "Template created.", templateId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function updateEmailTemplateAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(updateTemplateSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const { id } = await service.updateEmailTemplate(session, parsed.data);
    revalidateTemplates();
    return { success: "Template updated.", templateId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function duplicateEmailTemplateAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(templateIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const { id } = await service.duplicateEmailTemplate(session, parsed.data.id);
    revalidateTemplates();
    return { success: "Template duplicated.", templateId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function archiveEmailTemplateAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(templateIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const { id } = await service.archiveEmailTemplate(session, parsed.data.id);
    revalidateTemplates();
    return { success: "Template archived.", templateId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function restoreEmailTemplateAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(templateIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const { id } = await service.restoreEmailTemplate(session, parsed.data.id);
    revalidateTemplates();
    return { success: "Template restored.", templateId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function deleteEmailTemplateAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(templateIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const { id } = await service.deleteEmailTemplate(session, parsed.data.id);
    revalidateTemplates();
    return { success: "Template deleted.", templateId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function setDefaultEmailTemplateAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(setDefaultTemplateSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const result = await service.setDefaultEmailTemplate(session, parsed.data);
    revalidateTemplates();
    return { success: "Default template updated.", templateId: result.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function testRenderTemplateAction(
  input: unknown
): Promise<ActionState & { data?: { subject: string; body: string } }> {
  try {
    const parsed = safeParseWithSchema(testRenderTemplateSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const data = service.testRenderTemplate(session, parsed.data);
    return { success: "OK", data };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function scheduleMessageAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(scheduleMessageSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const result = await service.scheduleMessage(session, parsed.data);
    revalidateCommunicationList();
    revalidateCommunicationDraft(result.id);
    revalidateCandidateDetail(parsed.data.candidateId);
    revalidatePath("/admin/recruitment");
    return { success: "Message scheduled.", communicationId: result.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function rescheduleMessageAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(rescheduleMessageSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const result = await service.rescheduleMessage(session, parsed.data);
    revalidateCommunicationList();
    return { success: "Message rescheduled.", communicationId: result.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function cancelScheduleAction(
  _prev: RecruitmentCommunicationActionState,
  input: unknown
): Promise<RecruitmentCommunicationActionState> {
  try {
    const parsed = safeParseWithSchema(cancelScheduleSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const existing = await service.getCommunication(session, parsed.data.id);
    const result = await service.cancelSchedule(session, parsed.data.id);
    revalidateCommunicationList();
    revalidateCandidateDetail(existing.candidateId);
    return { success: "Schedule cancelled.", communicationId: result.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function getCommunicationAnalyticsAction(): Promise<
  ActionState & { data?: unknown }
> {
  try {
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createCommunicationService();
    const data = await service.getCommunicationAnalytics(session);
    return { success: "OK", data };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
