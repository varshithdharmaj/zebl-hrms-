import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
} from "@/generated/prisma/enums";
import { CommunicationEmptyState } from "@/components/recruitment/communications/communication-empty-state";
import { CommunicationLoadingSkeleton } from "@/components/recruitment/communications/communication-loading-skeleton";
import { CommunicationSearch } from "@/components/recruitment/communications/communication-search";
import { CommunicationThread } from "@/components/recruitment/communications/communication-thread";
import { CommunicationListItem } from "@/components/recruitment/communications/communication-list-item";
import {
  toCommunicationListItemView,
  toCommunicationThreadMessageView,
} from "@/components/recruitment/communications/mappers";
import type { CommunicationRecord } from "@/lib/recruitment/repositories/communication-repository";
import type { CommunicationListItemView } from "@/components/recruitment/communications/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/recruitment/communications",
  useSearchParams: () => new URLSearchParams("tab=inbox"),
}));

function sampleItem(
  overrides: Partial<CommunicationListItemView> = {}
): CommunicationListItemView {
  return {
    id: "comm-1",
    type: RecruitmentCommunicationType.email_sent,
    status: RecruitmentCommunicationStatus.sent,
    subject: "Interview invitation",
    body: "Please join us on Monday for your interview.",
    candidateId: "cand-1",
    applicationId: "app-1",
    jobOpeningId: "job-1",
    interviewId: null,
    offerId: null,
    templateId: "tpl-1",
    senderUserId: "user-hr",
    recipientEmail: "ada@example.com",
    threadId: "thread-1",
    parentId: null,
    sentAt: "2026-08-05T10:00:00.000Z",
    deliveredAt: null,
    createdAt: "2026-08-05T09:00:00.000Z",
    updatedAt: "2026-08-05T10:00:00.000Z",
    candidateName: "Ada Lovelace",
    candidateEmail: "ada@example.com",
    jobTitle: "Engineer",
    senderEmail: "hr@zebl.com",
    templateName: "Interview Invitation",
    templateType: null,
    attachmentCount: 1,
    attachments: [
      {
        id: "att-1",
        fileName: "resume.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
        storagePath: "communications/comm-1/attachments/resume.pdf",
        uploadedAt: "2026-08-05T09:30:00.000Z",
      },
    ],
    isUnread: false,
    ...overrides,
  };
}

describe("Communication Center UI", () => {
  it("renders empty states per tab", () => {
    const inbox = renderToStaticMarkup(<CommunicationEmptyState tab="inbox" />);
    const sent = renderToStaticMarkup(<CommunicationEmptyState tab="sent" />);
    const drafts = renderToStaticMarkup(<CommunicationEmptyState tab="drafts" />);

    expect(inbox).toContain("Inbox is empty");
    expect(sent).toContain("No sent messages");
    expect(drafts).toContain("No drafts");
  });

  it("renders loading skeleton with accessible busy state", () => {
    const html = renderToStaticMarkup(<CommunicationLoadingSkeleton />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading communications");
  });

  it("renders search input with accessible label", () => {
    const html = renderToStaticMarkup(
      <CommunicationSearch defaultValue="offer" />
    );
    expect(html).toContain("Search communications");
    expect(html).toContain('value="offer"');
  });

  it("renders list item with draft badge and unread indicator", () => {
    const html = renderToStaticMarkup(
      <CommunicationListItem
        item={sampleItem({
          status: RecruitmentCommunicationStatus.draft,
          subject: "Draft offer note",
          isUnread: true,
        })}
        selected={false}
        onSelect={() => undefined}
      />
    );
    expect(html).toContain("Draft offer note");
    expect(html).toContain("Draft");
    expect(html).toContain("Unread");
  });

  it("renders thread conversation with template badge and delete action for drafts", () => {
    const html = renderToStaticMarkup(
      <CommunicationThread
        messages={[
          {
            ...sampleItem({
              status: RecruitmentCommunicationStatus.draft,
              templateName: "Offer Letter",
            }),
            bodyHtmlSafe: "Body",
          },
        ]}
        onDeleteDraft={() => undefined}
      />
    );
    expect(html).toContain("Interview invitation");
    expect(html).toContain("Template: Offer Letter");
    expect(html).toContain("Delete draft");
    expect(html).toContain("resume.pdf");
    expect(html).toContain("hr@zebl.com");
  });

  it("renders thread empty state when no message selected", () => {
    const html = renderToStaticMarkup(<CommunicationThread messages={[]} />);
    expect(html).toContain("Select a conversation");
  });

  it("maps repository records for list and thread views", () => {
    const record: CommunicationRecord = {
      id: "comm-2",
      type: RecruitmentCommunicationType.email_received,
      status: RecruitmentCommunicationStatus.delivered,
      subject: "Re: Hello",
      body: "Thanks",
      candidateId: "cand-1",
      applicationId: null,
      jobOpeningId: null,
      interviewId: null,
      offerId: null,
      templateId: null,
      senderUserId: null,
      recipientEmail: "hr@zebl.com",
      threadId: "thread-2",
      parentId: null,
      sentAt: new Date("2026-08-05T12:00:00.000Z"),
      deliveredAt: null,
      scheduledFor: null,
      errorMessage: null,
      metadata: {},
      createdAt: new Date("2026-08-05T12:00:00.000Z"),
      updatedAt: new Date("2026-08-05T12:00:00.000Z"),
      deletedAt: null,
      candidate: { id: "cand-1", fullName: "Ada Lovelace", email: "ada@example.com" },
      attachments: [],
    };

    const listItem = toCommunicationListItemView(record);
    expect(listItem.isUnread).toBe(true);
    expect(listItem.candidateName).toBe("Ada Lovelace");
    expect(listItem.sentAt).toBe("2026-08-05T12:00:00.000Z");

    const threadItem = toCommunicationThreadMessageView(record);
    expect(threadItem.bodyHtmlSafe).toBe("Thanks");
  });

  it("marks received messages as read when metadata says so", () => {
    const record: CommunicationRecord = {
      id: "comm-3",
      type: RecruitmentCommunicationType.email_received,
      status: RecruitmentCommunicationStatus.delivered,
      subject: "Read mail",
      body: "Body",
      candidateId: null,
      applicationId: null,
      jobOpeningId: null,
      interviewId: null,
      offerId: null,
      templateId: null,
      senderUserId: null,
      recipientEmail: "hr@zebl.com",
      threadId: "thread-3",
      parentId: null,
      sentAt: null,
      deliveredAt: null,
      scheduledFor: null,
      errorMessage: null,
      metadata: { read: true },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    expect(toCommunicationListItemView(record).isUnread).toBe(false);
  });
});
