"use client";

import { useState, useTransition } from "react";
import { Download, Eye, FileText, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeCommunicationAttachmentAction } from "@/actions/recruitment-communications";
import {
  formatAttachmentSize,
  isPreviewableAttachment,
} from "@/lib/recruitment/communication/attachment-rules";
import type { CommunicationAttachmentView } from "../types";
import { AttachmentPreviewDialog } from "./attachment-preview-dialog";

export function AttachmentList({
  attachments,
  canRemove = false,
  onChanged,
  dense = false,
}: {
  attachments: CommunicationAttachmentView[];
  canRemove?: boolean;
  onChanged?: (attachmentId?: string) => void;
  dense?: boolean;
}) {
  const [preview, setPreview] = useState<CommunicationAttachmentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (attachments.length === 0) {
    return (
      <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" aria-hidden />
        No attachments
      </p>
    );
  }

  const handleRemove = (attachment: CommunicationAttachmentView) => {
    setError(null);
    startTransition(async () => {
      const result = await removeCommunicationAttachmentAction({}, { id: attachment.id });
      if (result.error) {
        setError(result.error);
        return;
      }
      onChanged?.(attachment.id);
    });
  };

  return (
    <div className="space-y-2" aria-label="Attachments">
      <ul className={dense ? "space-y-1.5" : "space-y-2"}>
        {attachments.map((attachment) => {
          const canPreview = isPreviewableAttachment(attachment);
          const downloadUrl = `/api/recruitment/communications/attachments/download?id=${encodeURIComponent(attachment.id)}`;

          return (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/80 px-2.5 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {attachment.fileName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatAttachmentSize(attachment.fileSize)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {canPreview && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    aria-label={`Preview ${attachment.fileName}`}
                    onClick={() => setPreview(attachment)}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )}
                <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <a
                    href={downloadUrl}
                    download
                    aria-label={`Download ${attachment.fileName}`}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </Button>
                {canRemove && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-danger"
                    aria-label={`Remove ${attachment.fileName}`}
                    disabled={isPending}
                    onClick={() => handleRemove(attachment)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      <AttachmentPreviewDialog
        attachment={preview}
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />
    </div>
  );
}
