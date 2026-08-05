import type { CommunicationRecord } from "@/lib/recruitment/repositories/communication-repository";
import type {
  CommunicationListItemView,
  CommunicationThreadMessageView,
} from "./types";

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function isUnread(record: CommunicationRecord): boolean {
  if (record.type !== "email_received") return false;
  if (!record.metadata || typeof record.metadata !== "object") return true;
  const meta = record.metadata as Record<string, unknown>;
  return meta.read !== true;
}

export function toCommunicationListItemView(
  record: CommunicationRecord
): CommunicationListItemView {
  const attachments = (record.attachments ?? []).map((attachment) => ({
    id: attachment.id,
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    fileSize: attachment.fileSize,
    storagePath: attachment.storagePath,
    uploadedAt: toIso(attachment.uploadedAt) ?? new Date(0).toISOString(),
  }));

  return {
    id: record.id,
    type: record.type,
    status: record.status,
    subject: record.subject,
    body: record.body,
    candidateId: record.candidateId,
    applicationId: record.applicationId,
    jobOpeningId: record.jobOpeningId,
    interviewId: record.interviewId,
    offerId: record.offerId,
    templateId: record.templateId,
    senderUserId: record.senderUserId,
    recipientEmail: record.recipientEmail,
    threadId: record.threadId,
    parentId: record.parentId,
    sentAt: toIso(record.sentAt),
    deliveredAt: toIso(record.deliveredAt),
    createdAt: toIso(record.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(record.updatedAt) ?? new Date(0).toISOString(),
    candidateName: record.candidate?.fullName ?? null,
    candidateEmail: record.candidate?.email ?? null,
    jobTitle: record.jobOpening?.title ?? null,
    senderEmail: record.sender?.email ?? null,
    templateName: record.template?.name ?? null,
    templateType: record.template?.type ?? null,
    attachmentCount: attachments.length,
    attachments,
    isUnread: isUnread(record),
  };
}

export function toCommunicationThreadMessageView(
  record: CommunicationRecord
): CommunicationThreadMessageView {
  const base = toCommunicationListItemView(record);
  return {
    ...base,
    bodyHtmlSafe: record.body ?? "",
  };
}
