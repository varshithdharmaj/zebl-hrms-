"use client";

import { memo } from "react";
import { User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageBubble } from "./message-bubble";
import type { CommunicationThreadMessageView } from "./types";

export const CommunicationThread = memo(function CommunicationThread({
  messages,
  onDeleteDraft,
  canWrite = true,
  onAttachmentsChanged,
}: {
  messages: CommunicationThreadMessageView[];
  onDeleteDraft?: (messageId: string) => void;
  canWrite?: boolean;
  onAttachmentsChanged?: () => void;
}) {
  if (messages.length === 0) {
    return (
      <EmptyState
        icon={User}
        title="Select a conversation"
        description="Choose a message from the list to view the full thread."
        className="min-h-[24rem]"
      />
    );
  }

  const subject = messages[messages.length - 1]?.subject ?? "Conversation";

  return (
    <Card className="flex h-full min-h-[24rem] flex-col shadow-subtle">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="text-base font-semibold text-slate-900">
          {subject?.trim() || "Untitled conversation"}
        </CardTitle>
        <p className="text-xs text-slate-500">
          {messages.length} message{messages.length === 1 ? "" : "s"} in thread
        </p>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4">
        <ol className="space-y-4" aria-label="Conversation thread">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              canWrite={canWrite}
              showTimelineMarker
              onDeleteDraft={onDeleteDraft}
              onAttachmentsChanged={onAttachmentsChanged}
            />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
});
