import { describe, expect, it } from "vitest";
import {
  COMMUNICATION_ATTACHMENT_MAX_BYTES,
  isPreviewableAttachment,
  mergeCandidateRecruitmentTimeline,
  validateCommunicationAttachment,
} from "@/lib/recruitment/communication";
import {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
  RecruitmentTimelineEntityType,
} from "@/generated/prisma/enums";
import type { CommunicationRecord } from "@/lib/recruitment/repositories/communication-repository";
import type { TimelineItem } from "@/lib/recruitment/types/timeline";

describe("communication attachment rules", () => {
  it("accepts allowed attachment types", () => {
    const result = validateCommunicationAttachment({
      fileName: "resume.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects oversized attachments", () => {
    const result = validateCommunicationAttachment({
      fileName: "big.pdf",
      fileType: "application/pdf",
      fileSize: COMMUNICATION_ATTACHMENT_MAX_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("file_too_large");
  });

  it("rejects unsupported types", () => {
    const result = validateCommunicationAttachment({
      fileName: "note.zip",
      fileType: "application/zip",
      fileSize: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("unsupported_type");
  });

  it("allows extension fallback when mime is octet-stream", () => {
    const result = validateCommunicationAttachment({
      fileName: "notes.txt",
      fileType: "application/octet-stream",
      fileSize: 40,
    });
    expect(result.ok).toBe(true);
  });

  it("marks previewable formats", () => {
    expect(
      isPreviewableAttachment({ fileName: "a.pdf", fileType: "application/pdf" })
    ).toBe(true);
    expect(
      isPreviewableAttachment({ fileName: "a.docx", fileType: "application/msword" })
    ).toBe(false);
  });
});

describe("candidate recruitment timeline merge", () => {
  it("orders communications and timeline events chronologically", () => {
    const timeline: TimelineItem[] = [
      {
        id: "t1",
        entityType: RecruitmentTimelineEntityType.candidate,
        entityId: "cand-1",
        applicationId: null,
        candidateId: "cand-1",
        jobOpeningId: null,
        eventType: "InterviewScheduled",
        summary: "Interview scheduled",
        actorUserId: "user-hr",
        metadata: {},
        createdAt: new Date("2026-08-04T10:00:00.000Z"),
      },
      {
        id: "t2",
        entityType: RecruitmentTimelineEntityType.candidate,
        entityId: "cand-1",
        applicationId: null,
        candidateId: "cand-1",
        jobOpeningId: null,
        eventType: "OfferSent",
        summary: "Offer sent",
        actorUserId: "user-hr",
        metadata: {},
        createdAt: new Date("2026-08-06T10:00:00.000Z"),
      },
    ];

    const communications: CommunicationRecord[] = [
      {
        id: "c1",
        type: RecruitmentCommunicationType.email_sent,
        status: RecruitmentCommunicationStatus.sent,
        subject: "Hello",
        body: "Body",
        candidateId: "cand-1",
        applicationId: null,
        jobOpeningId: null,
        interviewId: null,
        offerId: null,
        templateId: null,
        senderUserId: "user-hr",
        recipientEmail: "a@b.com",
        threadId: "c1",
        parentId: null,
        sentAt: new Date("2026-08-05T10:00:00.000Z"),
        deliveredAt: null,
        scheduledFor: null,
        errorMessage: null,
        metadata: {},
        createdAt: new Date("2026-08-05T09:00:00.000Z"),
        updatedAt: new Date("2026-08-05T10:00:00.000Z"),
        deletedAt: null,
      },
    ];

    const merged = mergeCandidateRecruitmentTimeline({ timeline, communications });
    expect(merged[0]?.summary).toContain("Offer");
    expect(merged[1]?.communicationId).toBe("c1");
    expect(merged[2]?.eventType).toBe("InterviewScheduled");
    expect(merged.some((item) => item.source === "interview")).toBe(true);
    expect(merged.some((item) => item.source === "offer")).toBe(true);
    expect(merged.some((item) => item.source === "communication")).toBe(true);
  });
});
