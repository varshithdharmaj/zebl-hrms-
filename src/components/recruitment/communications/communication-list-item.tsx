"use client";

import { memo } from "react";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CommunicationListItemView } from "./types";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewBody(body: string | null): string {
  if (!body) return "No content";
  const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > 90 ? `${plain.slice(0, 90)}…` : plain;
}

export const CommunicationListItem = memo(function CommunicationListItem({
  item,
  selected,
  onSelect,
}: {
  item: CommunicationListItemView;
  selected: boolean;
  onSelect: (item: CommunicationListItemView) => void;
}) {
  const timestamp = item.sentAt ?? item.createdAt;
  const statusLabel =
    item.status === "draft"
      ? "Draft"
      : item.status === "sent" || item.status === "delivered"
        ? "Sent"
        : item.status;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-current={selected ? "true" : undefined}
      aria-label={`${item.subject ?? "Untitled message"}, ${statusLabel}`}
      className={cn(
        "w-full rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        selected
          ? "border-slate-300 bg-slate-50"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50/80",
        item.isUnread && !selected && "bg-blue-50/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          {item.isUnread && (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-blue-600"
              aria-label="Unread"
              title="Unread"
            />
          )}
          <p className="truncate text-sm font-semibold text-slate-900">
            {item.subject?.trim() || "Untitled"}
          </p>
        </div>
        <StatusBadge status={statusLabel} className="shrink-0 text-[10px]" />
      </div>

      <p className="mt-1 truncate text-xs text-slate-600">
        {item.candidateName ?? item.recipientEmail ?? "No recipient"}
        {item.jobTitle ? ` · ${item.jobTitle}` : ""}
      </p>

      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{previewBody(item.body)}</p>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>{formatWhen(timestamp)}</span>
        {item.attachmentCount > 0 && (
          <span className="inline-flex items-center gap-1" aria-label={`${item.attachmentCount} attachments`}>
            <Paperclip className="h-3 w-3" aria-hidden />
            {item.attachmentCount}
          </span>
        )}
      </div>
    </button>
  );
});
