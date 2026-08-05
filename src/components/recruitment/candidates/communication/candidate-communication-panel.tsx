"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailPlus, MessagesSquare } from "lucide-react";
import { AppTabs } from "@/components/ui/app-tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deleteDraftAction,
  duplicateDraftAction,
} from "@/actions/recruitment-communications";
import { MessageBubble } from "@/components/recruitment/communications/message-bubble";
import { CommunicationDeleteDialog } from "@/components/recruitment/communications/communication-delete-dialog";
import type { CommunicationThreadMessageView } from "@/components/recruitment/communications/types";
import type { MergedCandidateTimelineItem } from "@/lib/recruitment/communication/candidate-timeline";
import { formatRelativeTimestamp } from "@/components/recruitment/communications/relative-time";
import { CandidateSection } from "../candidate-section";

type FilterId =
  | "all"
  | "drafts"
  | "sent"
  | "received"
  | "interview"
  | "offer"
  | "system"
  | "notes";

function matchesFilter(
  message: CommunicationThreadMessageView,
  filter: FilterId
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "drafts":
      return message.status === "draft";
    case "sent":
      return (
        message.type === "email_sent" &&
        (message.status === "sent" || message.status === "delivered")
      );
    case "received":
      return message.type === "email_received";
    case "interview":
      return (
        message.type === "interview_invitation" ||
        message.type === "interview_reminder"
      );
    case "offer":
      return message.type === "offer_letter";
    case "system":
      return message.type === "system_notification";
    case "notes":
      return message.type === "internal_note";
    default:
      return true;
  }
}

const PAGE_SIZE = 10;

export function CandidateCommunicationPanel({
  candidateId,
  candidateEmail,
  messages,
  mergedTimeline,
  canWrite,
}: {
  candidateId: string;
  candidateEmail: string | null;
  messages: CommunicationThreadMessageView[];
  mergedTimeline: MergedCandidateTimelineItem[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>("all");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () => messages.filter((message) => matchesFilter(message, filter)),
    [messages, filter]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(() => {
    const tally = {
      all: messages.length,
      drafts: 0,
      sent: 0,
      received: 0,
      interview: 0,
      offer: 0,
      system: 0,
      notes: 0,
    };
    for (const message of messages) {
      if (message.status === "draft") tally.drafts += 1;
      if (
        message.type === "email_sent" &&
        (message.status === "sent" || message.status === "delivered")
      ) {
        tally.sent += 1;
      }
      if (message.type === "email_received") tally.received += 1;
      if (
        message.type === "interview_invitation" ||
        message.type === "interview_reminder"
      ) {
        tally.interview += 1;
      }
      if (message.type === "offer_letter") tally.offer += 1;
      if (message.type === "system_notification") tally.system += 1;
      if (message.type === "internal_note") tally.notes += 1;
    }
    return tally;
  }, [messages]);

  const composeHref = `/admin/recruitment/communications/new?candidateId=${encodeURIComponent(candidateId)}${
    candidateEmail ? `&recipientEmail=${encodeURIComponent(candidateEmail)}` : ""
  }`;

  const handleDuplicate = (messageId: string) => {
    setError(null);
    setStatusMessage(null);
    startTransition(async () => {
      const result = await duplicateDraftAction({}, { id: messageId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatusMessage("Draft duplicated.");
      if (result.communicationId) {
        router.push(
          `/admin/recruitment/communications/drafts/${result.communicationId}`
        );
        return;
      }
      router.refresh();
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteId) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDraftAction({}, { id: deleteId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeleteId(null);
      setStatusMessage("Draft deleted.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <CandidateSection
        title="Communication"
        description="Conversation history, drafts, and recruitment messages for this candidate."
        action={
          canWrite ? (
            <Button asChild size="sm" className="gap-1.5 font-semibold">
              <Link href={composeHref} aria-label="Compose email to candidate">
                <MailPlus className="h-4 w-4" aria-hidden />
                Compose Email
              </Link>
            </Button>
          ) : undefined
        }
      >
        <AppTabs
          tabs={[
            { id: "all", label: "All", count: counts.all },
            { id: "drafts", label: "Drafts", count: counts.drafts },
            { id: "sent", label: "Sent", count: counts.sent },
            { id: "received", label: "Received", count: counts.received },
            { id: "interview", label: "Interview", count: counts.interview },
            { id: "offer", label: "Offer", count: counts.offer },
            { id: "system", label: "System", count: counts.system },
            { id: "notes", label: "Notes", count: counts.notes },
          ]}
          active={filter}
          onChange={(id) => {
            setFilter(id as FilterId);
            setPage(1);
          }}
          className="mb-4"
        />

        {(error || statusMessage) && (
          <p
            className={`mb-3 text-xs font-medium ${error ? "text-danger" : "text-emerald-700"}`}
            role="status"
          >
            {error ?? statusMessage}
          </p>
        )}

        {pageItems.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No communications yet"
            description={
              canWrite
                ? "Compose an email to start this candidate’s conversation timeline."
                : "No messages are available in your recruitment scope."
            }
            action={
              canWrite ? (
                <Button asChild size="sm">
                  <Link href={composeHref}>Compose Email</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ol className="space-y-4" aria-label="Candidate conversation timeline">
              {pageItems.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  canWrite={canWrite}
                  showTimelineMarker
                  onDeleteDraft={setDeleteId}
                  onDuplicateDraft={handleDuplicate}
                  onAttachmentsChanged={() => router.refresh()}
                />
              ))}
            </ol>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} · {filtered.length} messages
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page <= 1 || isPending}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages || isPending}
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CandidateSection>

      <CandidateSection
        title="Recruitment Timeline"
        description="Communications, interviews, offers, and conversion events in one chronology."
      >
        {mergedTimeline.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No timeline events"
            description="Activity will appear here as recruitment progresses."
          />
        ) : (
          <ol className="space-y-3" aria-label="Merged recruitment timeline">
            {mergedTimeline.slice(0, 30).map((item) => (
              <li
                key={item.id}
                className="relative border-l-2 border-border/80 pl-4 ml-2"
              >
                <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary/60 ring-4 ring-background" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.source}
                  </span>
                  <time
                    className="text-[10px] text-muted-foreground"
                    dateTime={item.occurredAt.toISOString()}
                  >
                    {formatRelativeTimestamp(item.occurredAt.toISOString())}
                  </time>
                </div>
                <p className="mt-1 text-xs font-semibold text-foreground">
                  {item.summary}
                </p>
                {item.threadId && (
                  <Link
                    href={`/admin/recruitment/communications?threadId=${encodeURIComponent(item.threadId)}`}
                    className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline"
                  >
                    Open thread
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </CandidateSection>

      <CommunicationDeleteDialog
        open={Boolean(deleteId)}
        pending={isPending}
        subject={
          messages.find((message) => message.id === deleteId)?.subject ?? null
        }
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
