"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, FileText, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAttachmentSize } from "@/lib/recruitment/communication/attachment-rules";
import type { CommunicationAttachmentView } from "../types";

export function AttachmentPreviewDialog({
  attachment,
  open,
  onOpenChange,
}: {
  attachment: CommunicationAttachmentView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!attachment) return null;

  const isPdf =
    attachment.fileType === "application/pdf" ||
    attachment.fileName.toLowerCase().endsWith(".pdf");
  const isImage =
    attachment.fileType.startsWith("image/") ||
    /\.(png|jpe?g)$/i.test(attachment.fileName);
  const isText =
    attachment.fileType === "text/plain" ||
    attachment.fileName.toLowerCase().endsWith(".txt");

  const previewUrl = `/api/recruitment/communications/attachments/preview?id=${encodeURIComponent(attachment.id)}`;
  const downloadUrl = `/api/recruitment/communications/attachments/download?id=${encodeURIComponent(attachment.id)}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 flex h-[85vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-elevated focus:outline-none"
          aria-label={`Preview ${attachment.fileName}`}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-sm font-semibold text-foreground">
                {attachment.fileName}
              </DialogPrimitive.Title>
              <p className="text-xs text-muted-foreground">
                {formatAttachmentSize(attachment.fileSize)} · {attachment.fileType}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={downloadUrl} download aria-label={`Download ${attachment.fileName}`}>
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Download
                </a>
              </Button>
              <DialogPrimitive.Close asChild>
                <Button size="sm" variant="ghost" aria-label="Close preview">
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-muted/20 p-4">
            {isPdf ? (
              <iframe
                title={`PDF preview of ${attachment.fileName}`}
                src={previewUrl}
                className="h-full min-h-[28rem] w-full rounded-lg border border-border bg-white"
                loading="lazy"
              />
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={`Preview of ${attachment.fileName}`}
                className="mx-auto max-h-full max-w-full rounded-lg border border-border object-contain"
                loading="lazy"
              />
            ) : isText ? (
              <iframe
                title={`Text preview of ${attachment.fileName}`}
                src={previewUrl}
                className="h-full min-h-[20rem] w-full rounded-lg border border-border bg-white p-2"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium text-foreground">Preview not available</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Download the file to view its contents.
                </p>
                <ImageIcon className="sr-only" />
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
