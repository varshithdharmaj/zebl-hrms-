"use client";

import { Clock3, Eye, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ComposeFooter({
  canSend,
  pending,
  hasDraft,
  onPreview,
  onSave,
  onSend,
  onSchedule,
  onDiscard,
}: {
  canSend: boolean;
  pending: boolean;
  hasDraft: boolean;
  onPreview: () => void;
  onSave: () => void;
  onSend: () => void;
  onSchedule: () => void;
  onDiscard: () => void;
}) {
  return (
    <footer
      className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-subtle backdrop-blur"
      aria-label="Compose actions"
    >
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPreview}
          disabled={pending}
          className="gap-1.5"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Preview
        </Button>
        {hasDraft && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={pending}
            className="gap-1.5 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Discard
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={pending}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" aria-hidden />
          Save draft
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSchedule}
          disabled={pending || !canSend}
          className="gap-1.5"
        >
          <Clock3 className="h-3.5 w-3.5" aria-hidden />
          Schedule
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSend}
          disabled={pending || !canSend}
          className="gap-1.5"
          aria-keyshortcuts="Control+Enter Meta+Enter"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Send
        </Button>
      </div>
    </footer>
  );
}
