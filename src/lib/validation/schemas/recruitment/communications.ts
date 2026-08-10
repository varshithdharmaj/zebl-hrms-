import { z } from "zod";
import {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
  RecruitmentEmailTemplateType,
} from "@/generated/prisma/enums";
import { recruitmentPaginationSchema } from "@/lib/validation/schemas/recruitment/infrastructure";

const communicationTypeSchema = z.nativeEnum(RecruitmentCommunicationType);
const communicationStatusSchema = z.nativeEnum(RecruitmentCommunicationStatus);
const emailTemplateTypeSchema = z.nativeEnum(RecruitmentEmailTemplateType);

export const communicationIdSchema = z.object({
  id: z.string().trim().min(1, "Communication ID is required."),
});

export const createDraftSchema = z.object({
  type: communicationTypeSchema.default(RecruitmentCommunicationType.email_sent),
  subject: z.string().trim().min(1, "Subject is required.").max(500),
  body: z.string().trim().min(1, "Body is required."),
  candidateId: z.string().trim().min(1).optional().nullable(),
  applicationId: z.string().trim().min(1).optional().nullable(),
  jobOpeningId: z.string().trim().min(1).optional().nullable(),
  interviewId: z.string().trim().min(1).optional().nullable(),
  offerId: z.string().trim().min(1).optional().nullable(),
  templateId: z.string().trim().min(1).optional().nullable(),
  recipientEmail: z.string().trim().email("Invalid recipient email.").optional().nullable(),
  parentId: z.string().trim().min(1).optional().nullable(),
  threadId: z.string().trim().min(1).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateDraftSchema = z.object({
  id: z.string().trim().min(1, "Communication ID is required."),
  subject: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).optional(),
  candidateId: z.string().trim().min(1).optional().nullable(),
  applicationId: z.string().trim().min(1).optional().nullable(),
  jobOpeningId: z.string().trim().min(1).optional().nullable(),
  interviewId: z.string().trim().min(1).optional().nullable(),
  offerId: z.string().trim().min(1).optional().nullable(),
  templateId: z.string().trim().min(1).optional().nullable(),
  recipientEmail: z.string().trim().email("Invalid recipient email.").optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const deleteDraftSchema = communicationIdSchema;

export const sendMessageSchema = z.object({
  id: z.string().trim().min(1).optional(),
  type: communicationTypeSchema.optional(),
  subject: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).optional(),
  candidateId: z.string().trim().min(1).optional().nullable(),
  applicationId: z.string().trim().min(1).optional().nullable(),
  jobOpeningId: z.string().trim().min(1).optional().nullable(),
  interviewId: z.string().trim().min(1).optional().nullable(),
  offerId: z.string().trim().min(1).optional().nullable(),
  templateId: z.string().trim().min(1).optional().nullable(),
  recipientEmail: z.string().trim().email("Invalid recipient email.").optional().nullable(),
  parentId: z.string().trim().min(1).optional().nullable(),
  threadId: z.string().trim().min(1).optional().nullable(),
  templateVariables: z.record(z.string(), z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (value) => Boolean(value.id) || (Boolean(value.subject) && Boolean(value.body)),
  { message: "Provide an existing draft id or subject and body to send." }
);

export const listCommunicationsSchema = z.object({
  candidateId: z.string().trim().optional(),
  applicationId: z.string().trim().optional(),
  jobOpeningId: z.string().trim().optional(),
  interviewId: z.string().trim().optional(),
  offerId: z.string().trim().optional(),
  type: communicationTypeSchema.optional(),
  status: communicationStatusSchema.optional(),
  senderUserId: z.string().trim().optional(),
  threadId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: recruitmentPaginationSchema.shape.page.optional(),
  pageSize: recruitmentPaginationSchema.shape.pageSize.optional(),
});

export const searchCommunicationsSchema = z.object({
  query: z.string().trim().min(1, "Search query is required."),
  candidateId: z.string().trim().optional(),
  applicationId: z.string().trim().optional(),
  jobOpeningId: z.string().trim().optional(),
  type: communicationTypeSchema.optional(),
  status: communicationStatusSchema.optional(),
  page: recruitmentPaginationSchema.shape.page.optional(),
  pageSize: recruitmentPaginationSchema.shape.pageSize.optional(),
});

export const getThreadSchema = z.object({
  threadId: z.string().trim().min(1, "Thread ID is required."),
});

export const uploadCommunicationAttachmentSchema = z.object({
  communicationId: z.string().trim().min(1, "Communication ID is required."),
  fileName: z.string().trim().min(1, "File name is required.").max(255),
  fileType: z.string().trim().min(1, "MIME type is required.").max(200),
  fileSize: z.number().int().positive("File size must be positive."),
  storagePath: z.string().trim().min(1, "Storage path is required.").max(1000),
});

export const attachmentIdSchema = z.object({
  id: z.string().trim().min(1, "Attachment ID is required."),
});

export const listAttachmentsSchema = z.object({
  communicationId: z.string().trim().min(1, "Communication ID is required."),
});

export const duplicateDraftSchema = z.object({
  id: z.string().trim().min(1, "Communication ID is required."),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required.").max(200),
  type: emailTemplateTypeSchema,
  subject: z.string().trim().min(1, "Subject is required.").max(500),
  body: z.string().trim().min(1, "Body is required."),
  isActive: z.boolean().optional().default(true),
});

export const updateTemplateSchema = z.object({
  id: z.string().trim().min(1, "Template ID is required."),
  name: z.string().trim().min(1).max(200).optional(),
  type: emailTemplateTypeSchema.optional(),
  subject: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const templateIdSchema = z.object({
  id: z.string().trim().min(1, "Template ID is required."),
});

export const listTemplatesAdminSchema = z.object({
  tab: z.enum(["active", "archived"]).optional().default("active"),
  type: emailTemplateTypeSchema.optional(),
  search: z.string().trim().optional(),
  includeSystem: z.boolean().optional().default(true),
});

export const setDefaultTemplateSchema = z.object({
  id: z.string().trim().min(1, "Template ID is required."),
  type: emailTemplateTypeSchema,
});

export const testRenderTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1),
  variables: z.record(z.string(), z.string()).optional().default({}),
});

export const scheduleMessageSchema = z.object({
  id: z.string().trim().min(1).optional(),
  scheduledFor: z.string().datetime({ offset: true }).or(z.string().datetime()),
  subject: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).optional(),
  recipientEmail: z.string().trim().email().optional().nullable(),
  candidateId: z.string().trim().min(1).optional().nullable(),
  applicationId: z.string().trim().min(1).optional().nullable(),
  jobOpeningId: z.string().trim().min(1).optional().nullable(),
  interviewId: z.string().trim().min(1).optional().nullable(),
  offerId: z.string().trim().min(1).optional().nullable(),
  templateId: z.string().trim().min(1).optional().nullable(),
  type: communicationTypeSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (value) => Boolean(value.id) || (Boolean(value.subject) && Boolean(value.body)),
  { message: "Provide an existing draft id or subject and body to schedule." }
);

export const rescheduleMessageSchema = z.object({
  id: z.string().trim().min(1, "Communication ID is required."),
  scheduledFor: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

export const cancelScheduleSchema = communicationIdSchema;

export type CreateDraftInput = z.infer<typeof createDraftSchema>;
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListCommunicationsInput = z.infer<typeof listCommunicationsSchema>;
export type SearchCommunicationsInput = z.infer<typeof searchCommunicationsSchema>;
export type UploadCommunicationAttachmentInput = z.infer<
  typeof uploadCommunicationAttachmentSchema
>;
export type DuplicateDraftInput = z.infer<typeof duplicateDraftSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ListTemplatesAdminInput = z.infer<typeof listTemplatesAdminSchema>;
export type ScheduleMessageInput = z.infer<typeof scheduleMessageSchema>;
