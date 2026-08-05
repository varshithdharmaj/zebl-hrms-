"use client";

import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, FileText, FileCode, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CandidateDocumentPreviewProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  mimeType: string | null;
  /** Document id — preferred locator (server resolves storage key). */
  documentId: string;
  /** @deprecated Prefer documentId; kept for backward-compatible call sites. */
  storageKey?: string;
}

export function CandidateDocumentPreview({
  isOpen,
  onOpenChange,
  fileName,
  mimeType,
  documentId,
  storageKey,
}: CandidateDocumentPreviewProps) {
  const previewQuery = documentId
    ? `id=${encodeURIComponent(documentId)}`
    : `key=${encodeURIComponent(storageKey ?? "")}`;
  const downloadQuery = `${previewQuery}&name=${encodeURIComponent(fileName)}`;
  const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const isImage =
    mimeType?.startsWith("image/") ||
    [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((ext) => fileName.toLowerCase().endsWith(ext));

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-0 shadow-elevated focus:outline-none flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/10 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {isPdf ? (
                <FileText className="h-5 w-5 text-red-500 shrink-0" />
              ) : isImage ? (
                <FileCode className="h-5 w-5 text-blue-500 shrink-0" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <DialogPrimitive.Title className="text-sm font-semibold text-foreground truncate max-w-md sm:max-w-xl">
                {fileName}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          {/* Content Preview Area */}
          <div className="flex-1 bg-muted/5 p-6 overflow-auto flex flex-col items-center justify-center">
            {isPdf ? (
              <iframe
                src={`/api/recruitment/documents/preview?${previewQuery}`}
                className="w-full h-full rounded-lg border border-border bg-background shadow-subtle"
                title={fileName}
              />
            ) : isImage ? (
              <div className="relative max-w-full max-h-full rounded-lg overflow-hidden border border-border bg-background shadow-subtle flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/recruitment/documents/preview?${previewQuery}`}
                  alt={fileName}
                  className="max-w-full max-h-[65vh] object-contain"
                />
              </div>
            ) : (
              <div className="text-center p-8 border border-dashed border-border rounded-xl bg-card max-w-md shadow-subtle">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border mb-4 mx-auto shadow-subtle">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Preview Not Available</h4>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  Previews are only supported for PDF and image files (.jpg, .jpeg, .png, .webp). You can download this file to view its contents.
                </p>
                <Button asChild size="sm" className="font-semibold shadow-subtle">
                  <a href={`/api/recruitment/documents/download?${downloadQuery}`}>
                    Download File
                  </a>
                </Button>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
