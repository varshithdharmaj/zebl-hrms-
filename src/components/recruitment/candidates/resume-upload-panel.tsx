"use client";

import React, { useId, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { cn } from "@/lib/utils";
import {
  formatResumeFileSize,
  RESUME_UPLOAD_ACCEPT,
  RESUME_UPLOAD_MAX_BYTES,
  validateResumeFile,
} from "@/lib/recruitment/resume-import/file-validation";

export type ResumeUploadPanelProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onContinue: () => void;
  onBack: () => void;
  /** When true, shows the accepted/success chrome after a valid selection. */
  showSuccess?: boolean;
};

export function ResumeUploadPanel({
  file,
  onFileChange,
  onContinue,
  onBack,
  showSuccess = false,
}: ResumeUploadPanelProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyFile(next: File | null) {
    if (!next) {
      setError(null);
      onFileChange(null);
      return;
    }

    const result = validateResumeFile(next);
    if (!result.ok) {
      setError(result.error);
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setError(null);
    onFileChange(result.file);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    applyFile(dropped);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function handleReplace() {
    openPicker();
  }

  function handleRemove() {
    applyFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <SectionCard
      title="Upload Resume"
      description="Select a PDF or DOCX resume. We extract structured fields with the deterministic parser — AI enrichment runs only after the candidate is created."
    >
      <div className="mx-auto w-full max-w-xl space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-muted p-3 text-xs text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {showSuccess && file && !error && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-400"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Resume ready: <strong className="font-semibold">{file.name}</strong>. Continue to
              extract candidate information.
            </span>
          </div>
        )}

        {!file ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload resume file"
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/10"
            )}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={openPicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPicker();
              }
            }}
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted shadow-subtle">
              <UploadCloud className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Drag & drop a resume here, or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF or DOCX · Max {formatResumeFileSize(RESUME_UPLOAD_MAX_BYTES)}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatResumeFileSize(file.size)} · Ready to extract
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleReplace}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="text-muted-foreground hover:bg-danger-muted/30 hover:text-danger"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="hidden"
          accept={RESUME_UPLOAD_ACCEPT}
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            applyFile(selected);
          }}
        />

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            className="font-semibold shadow-subtle"
            disabled={!file}
            onClick={onContinue}
          >
            Continue
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
