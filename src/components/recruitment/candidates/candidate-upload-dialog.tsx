"use client";

import React, { useRef, useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecruitmentDocumentType } from "@/generated/prisma/enums";
import { DOCUMENT_TYPE_LABELS } from "@/lib/recruitment/candidate/document-labels";
import { uploadCandidateDocumentAction } from "@/actions/recruitment-documents";
import {
  dismissResumeImportDraftAction,
  mergeCandidateResumeAction,
  prepareCandidateResumeMergeAction,
} from "@/actions/recruitment-resume-import";
import {
  ResumeConflictDialog,
  type ConflictField,
} from "@/components/recruitment/candidates/resume-conflict-dialog";
import { useRouter } from "next/navigation";

export interface CandidateUploadDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
}

type PendingMerge = {
  draftId: string;
  conflicts: ConflictField[];
};

export function CandidateUploadDialog({
  isOpen,
  onOpenChange,
  candidateId,
}: CandidateUploadDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState<RecruitmentDocumentType>(RecruitmentDocumentType.resume);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [isApplyingMerge, setIsApplyingMerge] = useState(false);
  const applyingRef = useRef(false);

  const resetLocal = () => {
    setFiles([]);
    setError(null);
    setSuccess(null);
    setStatusNote(null);
    setPendingMerge(null);
    setConflictOpen(false);
    setIsApplyingMerge(false);
    applyingRef.current = false;
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && (isPending || isApplyingMerge)) return;
    if (!open) resetLocal();
    onOpenChange(open);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...dropped]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConflictResolve = (resolutions: Record<string, string>) => {
    if (!pendingMerge || applyingRef.current || isApplyingMerge) return;
    applyingRef.current = true;
    setIsApplyingMerge(true);
    const draftId = pendingMerge.draftId;
    const selections: Record<string, "current" | "parsed"> = {};
    for (const conflict of pendingMerge.conflicts) {
      const chosen = resolutions[conflict.key];
      selections[conflict.key] =
        chosen === conflict.parsedValue ? "parsed" : "current";
    }
    // Keep conflict dialog open while merge runs so Apply pending is visible.
    setStatusNote("Applying selected fields…");

    startTransition(async () => {
      const res = await mergeCandidateResumeAction(
        {},
        { draftId, candidateId, conflictSelections: selections }
      );
      applyingRef.current = false;
      setIsApplyingMerge(false);
      if (res.error) {
        setError(res.error);
        setStatusNote(null);
        return;
      }
      setConflictOpen(false);
      setPendingMerge(null);
      setSuccess(res.success ?? "Candidate profile updated from resume.");
      setStatusNote(null);
      setFiles([]);
      router.refresh();
      setTimeout(() => {
        onOpenChange(false);
        resetLocal();
      }, 1200);
    });
  };

  const handleConflictDialogChange = (open: boolean) => {
    if (open) {
      setConflictOpen(true);
      return;
    }
    if (isPending || isApplyingMerge || applyingRef.current) return;

    // Cancel: keep uploaded document, dismiss draft, do not change profile.
    const draftId = pendingMerge?.draftId;
    setConflictOpen(false);
    if (!draftId) {
      setPendingMerge(null);
      setStatusNote(null);
      return;
    }
    setPendingMerge(null);
    setStatusNote(null);
    startTransition(async () => {
      await dismissResumeImportDraftAction({}, { draftId, candidateId });
      setSuccess("Resume kept as a document. Profile was not changed.");
      router.refresh();
      setTimeout(() => {
        onOpenChange(false);
        resetLocal();
      }, 1200);
    });
  };

  const handleUpload = () => {
    if (files.length === 0) {
      setError("Please select at least one file to upload.");
      return;
    }

    setError(null);
    setSuccess(null);
    setStatusNote(null);

    startTransition(async () => {
      try {
        if (docType === RecruitmentDocumentType.resume) {
          const file = files[0];
          if (!file) {
            setError("Please select a resume file.");
            return;
          }

          const formData = new FormData();
          formData.set("file", file);
          formData.set("candidateId", candidateId);
          formData.set("documentType", docType);

          const uploadRes = await uploadCandidateDocumentAction({}, formData);
          if (uploadRes.error || !uploadRes.documentId) {
            setError(uploadRes.error ?? "Upload failed.");
            return;
          }

          setSuccess("Resume uploaded successfully.");
          setStatusNote("Parsing resume and comparing with profile…");

          // TODO(resume-parser): replace stub draft with real parser output.
          const prepared = await prepareCandidateResumeMergeAction(
            {},
            { candidateId, documentId: uploadRes.documentId }
          );

          if (prepared.error || !prepared.draftId || !prepared.merge) {
            setError(prepared.error ?? "Resume was uploaded but merge preview failed.");
            setStatusNote(null);
            return;
          }

          if (!prepared.hasWork) {
            setSuccess(
              prepared.success ?? "Resume uploaded. No new profile details to merge."
            );
            setStatusNote(null);
            setFiles([]);
            router.refresh();
            setTimeout(() => {
              onOpenChange(false);
              resetLocal();
            }, 1200);
            return;
          }

          if (prepared.merge.conflicts.length > 0) {
            setPendingMerge({
              draftId: prepared.draftId,
              conflicts: prepared.merge.conflicts,
            });
            setStatusNote(
              "Resume uploaded. Resolve conflicting fields to finish updating the profile."
            );
            setConflictOpen(true);
            setFiles([]);
            router.refresh();
            return;
          }

          setStatusNote("Applying empty-field updates…");
          const mergeRes = await mergeCandidateResumeAction(
            {},
            {
              draftId: prepared.draftId,
              candidateId,
              conflictSelections: {},
            }
          );
          if (mergeRes.error) {
            setError(mergeRes.error);
            setStatusNote(null);
            return;
          }
          setSuccess(mergeRes.success ?? "Candidate profile updated from resume.");
          setStatusNote(null);
          setFiles([]);
          router.refresh();
          setTimeout(() => {
            onOpenChange(false);
            resetLocal();
          }, 1200);
          return;
        }

        let successCount = 0;
        let failMessage: string | null = null;

        for (const file of files) {
          const formData = new FormData();
          formData.set("file", file);
          formData.set("candidateId", candidateId);
          formData.set("documentType", docType);

          const res = await uploadCandidateDocumentAction({}, formData);

          if (res.error) {
            failMessage = res.error;
          } else {
            successCount++;
          }
        }

        if (successCount > 0) {
          setSuccess(`Successfully uploaded ${successCount} document(s).`);
          setFiles([]);
          router.refresh();
          setTimeout(() => {
            onOpenChange(false);
            resetLocal();
          }, 1500);
        }
        if (failMessage) {
          setError(failMessage);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        setStatusNote(null);
      }
    });
  };

  return (
    <>
      <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-elevated focus:outline-none flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
              <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                Upload Candidate Documents
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={isPending}>
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>

            <div className="space-y-4 py-4 overflow-auto max-h-[60vh]">
              {error && (
                <div className="p-3 rounded-lg border border-danger/20 bg-danger-muted text-xs text-danger flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 flex items-start gap-2 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              {statusNote && (
                <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground flex items-start gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin" />
                  <span>{statusNote}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="font-bold text-xs text-muted-foreground uppercase tracking-wider">
                  Document Type
                </Label>
                <Select
                  value={docType}
                  onValueChange={(v) => setDocType(v as RecruitmentDocumentType)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(RecruitmentDocumentType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {DOCUMENT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {docType === RecruitmentDocumentType.resume && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Uploading a resume will compare it with this profile, auto-fill empty
                    fields, and ask you before changing existing values.
                  </p>
                )}
              </div>

              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-150 flex flex-col items-center justify-center ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/10"
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <input
                  id="file-upload"
                  type="file"
                  multiple={docType !== RecruitmentDocumentType.resume}
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isPending}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted border border-border mb-3 shadow-subtle">
                  <UploadCloud className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supported formats: PDF, DOC, DOCX, JPG, PNG, TXT (Max 15MB)
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Selected Files
                  </p>
                  <ul className="divide-y divide-border/40 border border-border rounded-lg bg-muted/10 overflow-hidden">
                    {files.map((file, i) => (
                      <li key={`${file.name}-${i}`} className="flex items-center justify-between p-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium text-foreground truncate max-w-[250px]">
                            {file.name}
                          </span>
                          <span className="text-muted-foreground">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i);
                          }}
                          className="h-7 w-7 rounded-md text-muted-foreground hover:text-danger hover:bg-danger-muted/30"
                          disabled={isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4 shrink-0">
              <DialogPrimitive.Close asChild>
                <Button variant="outline" size="sm" disabled={isPending}>
                  Cancel
                </Button>
              </DialogPrimitive.Close>
              <Button
                size="sm"
                onClick={handleUpload}
                loading={isPending}
                disabled={files.length === 0}
                className="font-semibold shadow-subtle"
              >
                {isPending
                  ? "Working…"
                  : docType === RecruitmentDocumentType.resume
                    ? "Upload & Enrich"
                    : "Upload Documents"}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <ResumeConflictDialog
        isOpen={conflictOpen}
        onOpenChange={handleConflictDialogChange}
        conflicts={pendingMerge?.conflicts ?? []}
        onResolve={handleConflictResolve}
        isPending={isApplyingMerge}
      />
    </>
  );
}
