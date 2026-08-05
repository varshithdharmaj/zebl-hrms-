import type {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
  RecruitmentEmailTemplateType,
} from "@/generated/prisma/enums";

export type CommunicationTab = "inbox" | "sent" | "drafts" | "scheduled";

export type CommunicationAttachmentView = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  uploadedAt: string;
};

export type CommunicationListItemView = {
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
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  candidateName: string | null;
  candidateEmail: string | null;
  jobTitle: string | null;
  senderEmail: string | null;
  templateName: string | null;
  templateType: RecruitmentEmailTemplateType | null;
  attachmentCount: number;
  attachments: CommunicationAttachmentView[];
  isUnread: boolean;
};

export type CommunicationThreadMessageView = CommunicationListItemView & {
  bodyHtmlSafe: string;
};

export type CommunicationCenterCounts = {
  inbox: number;
  sent: number;
  drafts: number;
  scheduled: number;
};

export type CommunicationFilterState = {
  tab: CommunicationTab;
  q: string;
  type: string;
  page: number;
  pageSize: number;
  threadId: string | null;
};
