import type {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
  RecruitmentEmailTemplateType,
} from "@/generated/prisma/enums";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import type {
  PageResult,
  PaginationInput,
  RepositoryTx,
} from "@/lib/recruitment/repositories/types";

export type CommunicationListFilters = {
  candidateId?: string;
  applicationId?: string;
  jobOpeningId?: string;
  interviewId?: string;
  offerId?: string;
  type?: RecruitmentCommunicationType;
  status?: RecruitmentCommunicationStatus;
  senderUserId?: string;
  search?: string;
  threadId?: string;
  includeDeleted?: boolean;
};

export type CreateCommunicationInput = {
  type: RecruitmentCommunicationType;
  status?: RecruitmentCommunicationStatus;
  subject?: string | null;
  body?: string | null;
  candidateId?: string | null;
  applicationId?: string | null;
  jobOpeningId?: string | null;
  interviewId?: string | null;
  offerId?: string | null;
  templateId?: string | null;
  senderUserId?: string | null;
  recipientEmail?: string | null;
  threadId?: string | null;
  parentId?: string | null;
  scheduledFor?: Date | null;
  metadata?: Record<string, unknown>;
};

export type UpdateCommunicationInput = {
  status?: RecruitmentCommunicationStatus;
  subject?: string | null;
  body?: string | null;
  recipientEmail?: string | null;
  templateId?: string | null;
  candidateId?: string | null;
  applicationId?: string | null;
  jobOpeningId?: string | null;
  interviewId?: string | null;
  offerId?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  scheduledFor?: Date | null;
  errorMessage?: string | null;
  threadId?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreateTemplateInput = {
  name: string;
  type: RecruitmentEmailTemplateType;
  subject: string;
  body: string;
  isSystem?: boolean;
  isActive?: boolean;
  createdByUserId?: string | null;
};

export type UpdateTemplateInput = {
  name?: string;
  type?: RecruitmentEmailTemplateType;
  subject?: string;
  body?: string;
  isActive?: boolean;
};

export type ListTemplatesFilters = {
  type?: RecruitmentEmailTemplateType;
  isActive?: boolean;
  isSystem?: boolean;
  search?: string;
};

export type CommunicationAttachmentInput = {
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
};

export type CommunicationAttachmentRecord = {
  id: string;
  communicationId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  uploadedAt: Date;
};

export type CommunicationRecord = {
  id: string;
  type: RecruitmentCommunicationType;
  status: RecruitmentCommunicationStatus;
  subject: string | null;
  body: string | null;
  candidateId: string | null;
  applicationId: string | null;
  jobOpeningId: string | null;
  interviewId: string | null;
  offerId: string | null;
  templateId: string | null;
  senderUserId: string | null;
  recipientEmail: string | null;
  threadId: string | null;
  parentId: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  scheduledFor: Date | null;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  candidate?: { id: string; fullName: string; email: string | null } | null;
  application?: { id: string; jobOpeningId: string; candidateId: string } | null;
  jobOpening?: { id: string; title: string } | null;
  sender?: { id: string; email: string } | null;
  template?: { id: string; name: string; type: RecruitmentEmailTemplateType } | null;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
    uploadedAt: Date;
  }>;
};

export type EmailTemplateRecord = {
  id: string;
  name: string;
  type: RecruitmentEmailTemplateType;
  subject: string;
  body: string;
  isSystem: boolean;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type CommunicationRepository = {
  createCommunication(
    input: CreateCommunicationInput,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;

  updateCommunication(
    id: string,
    input: UpdateCommunicationInput,
    tx?: RepositoryTx
  ): Promise<void>;

  getCommunication(id: string): Promise<CommunicationRecord | null>;

  listCommunications(args: {
    scope: RecruitmentScope;
    filters?: CommunicationListFilters;
    pagination: PaginationInput;
  }): Promise<PageResult<CommunicationRecord>>;

  searchCommunications(args: {
    scope: RecruitmentScope;
    query: string;
    filters?: Omit<CommunicationListFilters, "search">;
    pagination: PaginationInput;
  }): Promise<PageResult<CommunicationRecord>>;

  getCommunicationThread(
    threadId: string,
    scope: RecruitmentScope
  ): Promise<CommunicationRecord[]>;

  softDeleteCommunication(id: string, tx?: RepositoryTx): Promise<void>;

  createTemplate(
    input: CreateTemplateInput,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;

  updateTemplate(
    id: string,
    input: UpdateTemplateInput,
    tx?: RepositoryTx
  ): Promise<void>;

  getTemplate(id: string): Promise<EmailTemplateRecord | null>;

  listTemplates(filters?: ListTemplatesFilters): Promise<EmailTemplateRecord[]>;

  softDeleteTemplate(id: string, tx?: RepositoryTx): Promise<void>;

  restoreTemplate(id: string, tx?: RepositoryTx): Promise<void>;

  addAttachment(
    communicationId: string,
    attachment: CommunicationAttachmentInput,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;

  getAttachment(id: string): Promise<CommunicationAttachmentRecord | null>;

  getAttachments(communicationId: string): Promise<
    Array<{
      id: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      storagePath: string;
      uploadedAt: Date;
    }>
  >;

  deleteAttachment(id: string, tx?: RepositoryTx): Promise<void>;

  countByStatus(
    status: RecruitmentCommunicationStatus,
    scope: RecruitmentScope,
    senderUserId?: string
  ): Promise<number>;

  countDraftsByUser(userId: string, scope: RecruitmentScope): Promise<number>;
};
