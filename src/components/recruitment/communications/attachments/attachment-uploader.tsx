"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCommunicationAttachmentAction } from "@/actions/recruitment-communications";
import {
  COMMUNICATION_ATTACHMENT_ALLOWED_EXTENSIONS,
  COMMUNICATION_ATTACHMENT_MAX_BYTES,
  validateCommunicationAttachment,
} from "@/lib/recruitment/communication/attachment-rules";
import type { CommunicationAttachmentView } from "../types";

export function AttachmentUploader({
  communicationId,
  onUploaded,
  disabled = false,
}: {
  communicationId: string;
  onUploaded?: (attachment: CommunicationAttachmentView) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<CommunicationAttachmentView[]>([]);
  const [isPending, startTransition] = useTransition();

  const accept = COMMUNICATION_ATTACHMENT_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    startTransition(async () => {
      for (const file of Array.from(files)) {
        const validation = validateCommunicationAttachment({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
        });
        if (!validation.ok) {
          setError(validation.message);
          continue;
        }

        const tempId = `optimistic-${file.name}-${file.size}`;
        const optimisticItem: CommunicationAttachmentView = {
          id: tempId,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          storagePath: "",
          uploadedAt: new Date().toISOString(),
        };
        setOptimistic((prev) => [optimisticItem, ...prev]);

        try {
          const body = new FormData();
          body.set("communicationId", communicationId);
          body.set("file", file);
          const result = await uploadCommunicationAttachmentAction({}, body);

          setOptimistic((prev) => prev.filter((item) => item.id !== tempId));

          if (result.error) {
            setError(result.error);
            continue;
          }

          onUploaded?.({
            ...optimisticItem,
            id: result.attachmentId ?? tempId,
          });
        } catch {
          setOptimistic((prev) => prev.filter((item) => item.id !== tempId));
          setError("Upload failed. Please try again.");
        }
      }

      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept}
        multiple
        disabled={disabled || isPending}
        onChange={(event) => handleFiles(event.target.files)}
        aria-label="Upload communication attachments"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={disabled || isPending}
        onClick={() => inputRef.current?.click()}
        aria-label="Add attachment"
      >
        {isPending ? (
          <Upload className="h-3.5 w-3.5 animate-pulse" aria-hidden />
        ) : (
          <Paperclip className="h-3.5 w-3.5" aria-hidden />
        )}
        {isPending ? "Uploading…" : "Add attachment"}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        PDF, DOC, DOCX, PNG, JPG, JPEG, TXT · max{" "}
        {COMMUNICATION_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB
      </p>
      {optimistic.length > 0 && (
        <ul className="space-y-1" aria-live="polite">
          {optimistic.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground"
            >
              Uploading {item.fileName}…
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}