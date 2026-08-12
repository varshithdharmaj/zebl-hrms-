"use client";

import Link from "next/link";
import {
  Copy,
  CornerUpLeft,
  Forward,
  ExternalLink,
  Pencil,
  Trash2,
  Clock3,
} from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import {
  cancelScheduleAction,
  rescheduleMessageAction,
} from "@/actions/recruitment-communications";
import { AttachmentList } from "./attachments/attachment-list";
import {
  formatAbsoluteTimestamp,
  formatRelativeTimestamp,
} from "./relative-time";
import type { CommunicationThreadMessageView } from "./types";

function initials(value: string | null | undefined): string {
  if (!value) return "?";
  const parts = value.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function typeLabel(type: CommunicationThreadMessageView["type"]): string {
  switch (type) {
    case "email_received":
      return "Received";
    case "email_sent":
      return "Sent";
    case "interview_invitation":
    case "interview_reminder":
      return "Interview";
    case "offer_letter":
      return "Offer";
    case "internal_note":
      return "Internal note";
    case "system_notification":
      return "System";
    case "rejection":
      return "Rejection";
    default:
      return type;
  }
}

function deliveryLabel(status: CommunicationThreadMessageView["status"]): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "failed":
      return "Failed";
    case "scheduled":
      return "Scheduled";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function MessageBubble({
  message,
  canWrite = false,
  onDeleteDraft,
  onDuplicateDraft,
  onAttachmentsChanged,
  showTimelineMarker = false,
}: {
  message: CommunicationThreadMessageView;
  canWrite?: boolean;
  onDeleteDraft?: (messageId: string) => void;
  onDuplicateDraft?: (messageId: string) => void;
  onAttachmentsChanged?: () => void;
  showTimelineMarker?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isInbound = message.type === "email_received";
  const isDraft = message.status === "draft";
  const isScheduled = message.status === "scheduled";
  const isNote = message.type === "internal_note";
  const timestamp = message.sentAt ?? message.createdAt;
  const composeReplyHref = `/admin/recruitment/communications/new?mode=reply&parentId=${encodeURIComponent(message.id)}&threadId=${encodeURIComponent(message.threadId ?? message.id)}&candidateId=${encodeURIComponent(message.candidateId ?? "")}`;
  const composeForwardHref = `/admin/recruitment/communications/new?mode=forward&parentId=${encodeURIComponent(message.id)}&candidateId=${encodeURIComponent(message.candidateId ?? "")}`;
  const openThreadHref = `/admin/recruitment/communications?threadId=${encodeURIComponent(message.threadId ?? message.id)}`;

  return (
    <li
      className={cn(
        "relative",
        showTimelineMarker && "border-l-2 border-border/70 pl-5 ml-2"
      )}
    >
      {showTimelineMarker && (
        <span
          className="absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background"
          aria-hidden
        />
      )}

      <article
        className={cn(
          "rounded-2xl border p-4 shadow-subtle",
          isInbound
            ? "border-slate-200 bg-white"
            : isNote
              ? "border-amber-200/80 bg-amber-50/40"
              : "border-teal-200/70 bg-teal-50/30",
          isDraft && "border-dashed"
        )}
        aria-label={`${typeLabel(message.type)} message: ${message.subject ?? "Untitled"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                isInbound
                  ? "bg-slate-900 text-white"
                  : "bg-teal-700 text-white"
              )}
              aria-hidden
            >
              {initials(isInbound ? message.candidateEmail ?? message.senderEmail : message.senderEmail)}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {isInbound
                  ? message.candidateName ?? message.candidateEmail ?? "Candidate"
                  : message.senderEmail ?? "You"}
              </p>
              <div className="flex flex-wrap gap-1.5" aria-label="Recipients">
                {(message.recipientEmail || message.candidateEmail) && (
                  <span className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border/60">
                    To: {message.recipientEmail ?? message.candidateEmail}
                  </span>
                )}
                {message.jobTitle && (
                  <span className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border/60">
                    {message.jobTitle}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              {typeLabel(message.type)}
            </span>
            {message.templateName && (
              <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                Template: {message.templateName}
              </span>
            )}
            <StatusBadge status={deliveryLabel(message.status)} className="text-[10px]" />
            <time
              className="text-[11px] text-muted-foreground"
              dateTime={timestamp}
              title={formatAbsoluteTimestamp(timestamp)}
            >
              {formatRelativeTimestamp(timestamp)}
            </time>
          </div>
        </div>

        <h3 className="mt-3 text-sm font-semibold text-foreground">
          {message.subject?.trim() || "Untitled"}
        </h3>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {message.body?.trim() || "No message body."}
        </div>

        <div className="mt-3">
          <AttachmentList
            attachments={message.attachments}
            canRemove={canWrite && isDraft}
            onChanged={onAttachmentsChanged}
            dense
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
            <Link href={openThreadHref} aria-label="Open thread in Communication Center">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Open thread
            </Link>
          </Button>

          {canWrite && !isDraft && (
            <>
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                <Link href={composeReplyHref} aria-label="Reply">
                  <CornerUpLeft className="h-3.5 w-3.5" aria-hidden />
                  Reply
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                <Link href={composeForwardHref} aria-label="Forward">
                  <Forward className="h-3.5 w-3.5" aria-hidden />
                  Forward
                </Link>
              </Button>
            </>
          )}

          {canWrite && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => onDuplicateDraft?.(message.id)}
              aria-label="Duplicate as draft"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Duplicate draft
            </Button>
          )}

          {isDraft && canWrite && (
            <>
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                <Link
                  href={`/admin/recruitment/communications/drafts/${message.id}`}
                  aria-label="Edit draft"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit draft
                </Link>
              </Button>
              {onDeleteDraft && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-danger"
                  onClick={() => onDeleteDraft(message.id)}
                  aria-label="Delete draft"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete
                </Button>
              )}
            </>
          )}

          {isScheduled && canWrite && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                loading={isPending}
                onClick={() => {
                  const raw = window.prompt(
                    "New schedule time",
                    new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)
                  );
                  if (!raw) return;
                  startTransition(async () => {
                    await rescheduleMessageAction(
                      {},
                      {
                        id: message.id,
                        scheduledFor: new Date(raw).toISOString(),
                      }
                    );
                    router.refresh();
                  });
                }}
                aria-label="Reschedule message"
              >
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                Reschedule
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                loading={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await cancelScheduleAction({}, { id: message.id });
                    router.refresh();
                  });
                }}
                aria-label="Cancel schedule"
              >
                Cancel schedule
              </Button>
            </>
          )}
        </div>
      </article>
    </li>
  );
}
