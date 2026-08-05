"use client";

import React, { useRef, useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ui/error-alert";
import { RecruitmentDocumentType } from "@/generated/prisma/enums";
import { DOCUMENT_TYPE_LABELS } from "@/lib/recruitment/candidate/document-labels";
import { CandidateEmptyState } from "./candidate-empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { CandidateDocumentPreview } from "./candidate-document-preview";
import {
  renameCandidateDocumentAction,
  deleteCandidateDocumentAction,
  restoreCandidateDocumentAction,
  setPrimaryResumeAction,
  replaceCandidateResumeAction,
} from "@/actions/recruitment-documents";
import { createResumeImportDraftAction } from "@/actions/recruitment-resume-import";
import {
  FileText,
  FileCode,
  Download,
  Edit2,
  Trash2,
  RotateCcw,
  Star,
  Eye,
  Check,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface CandidateDocumentRowProps {
  doc: {
    id: string;
    candidateId: string;
    documentType: RecruitmentDocumentType;
    fileName: string;
    mimeType: string | null;
    sizeBytes: number | null;
    storageKey: string;
    version?: number | null;
    isPrimary: boolean;
    createdAt: Date | string;
    deletedAt: Date | string | null;
    uploadedByUserId: string | null;
  };
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onSetPrimary: (id: string) => Promise<void>;
  onReplace: (id: string, file: File) => Promise<void>;
  onStartImport: (documentId: string) => Promise<void>;
  isPending: boolean;
}

export function CandidateDocumentRow({
  doc,
  onRename,
  onDelete,
  onRestore,
  onSetPrimary,
  onReplace,
  onStartImport,
  isPending,
}: CandidateDocumentRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(doc.fileName);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const isPdf = doc.mimeType === "application/pdf" || doc.fileName.toLowerCase().endsWith(".pdf");
  const isImage =
    doc.mimeType?.startsWith("image/") ||
    [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((ext) => doc.fileName.toLowerCase().endsWith(ext));

  const handleSaveRename = async () => {
    if (editName.trim() === "") return;
    await onRename(doc.id, editName.trim());
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setEditName(doc.fileName);
    setIsEditing(false);
  };

  return (
    <>
      <DataTableRow className={doc.deletedAt ? "opacity-60 bg-muted/10" : ""}>
        <DataTableCell>
          <div className="flex items-center gap-2">
            {isPdf ? (
              <FileText className="h-4 w-4 text-red-500 shrink-0" />
            ) : isImage ? (
              <FileCode className="h-4 w-4 text-blue-500 shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {DOCUMENT_TYPE_LABELS[doc.documentType]}
            </span>
          </div>
        </DataTableCell>
        <DataTableCell className="max-w-[200px] sm:max-w-[300px]">
          {isEditing ? (
            <div className="flex items-center gap-1.5 w-full">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-xs py-1"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSaveRename}
                disabled={isPending}
                className="h-7 w-7 rounded-md text-emerald-600 hover:bg-emerald-50/50"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancelRename}
                disabled={isPending}
                className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground text-sm truncate">{doc.fileName}</span>
              {doc.isPrimary && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
                  <Star className="h-3 w-3 fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400" />
                  Primary
                </span>
              )}
            </div>
          )}
        </DataTableCell>
        <DataTableCell className="tabular-nums text-xs font-semibold text-muted-foreground">
          v{doc.version || 1}
        </DataTableCell>
        <DataTableCell className="tabular-nums text-xs text-muted-foreground">
          {doc.sizeBytes ? `${(doc.sizeBytes / 1024).toFixed(1)} KB` : "—"}
        </DataTableCell>
        <DataTableCell className="text-xs text-muted-foreground">
          {formatDate(doc.createdAt)}
        </DataTableCell>
        <DataTableCell>
          <div className="flex items-center gap-1">
            {!doc.deletedAt && (isPdf || isImage) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPreviewOpen(true)}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                title="Preview Document"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              title="Download Document"
            >
              <a
                href={`/api/recruitment/documents/download?id=${encodeURIComponent(
                  doc.id
                )}&name=${encodeURIComponent(doc.fileName)}`}
              >
                <Download className="h-4 w-4" />
              </a>
            </Button>
            {!doc.deletedAt && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                  title="Rename Document"
                  disabled={isPending}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                {doc.documentType === RecruitmentDocumentType.resume && (
                  <>
                    <input
                      ref={replaceInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void onReplace(doc.id, file);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => replaceInputRef.current?.click()}
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                      title="Replace Resume"
                      disabled={isPending}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void onStartImport(doc.id)}
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                      title="Start Resume Import (stub draft)"
                      disabled={isPending}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {doc.documentType === RecruitmentDocumentType.resume && !doc.isPrimary && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onSetPrimary(doc.id)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-50/50"
                    title="Set as Primary Resume"
                    disabled={isPending}
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(doc.id)}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger-muted/30"
                  title="Delete Document"
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {doc.deletedAt && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRestore(doc.id)}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50/50"
                title="Restore Document"
                disabled={isPending}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DataTableCell>
      </DataTableRow>

      <CandidateDocumentPreview
        isOpen={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        fileName={doc.fileName}
        mimeType={doc.mimeType}
        documentId={doc.id}
      />
    </>
  );
}

export interface CandidateDocumentTableProps {
  documents: any[];
  candidateId: string;
}

export function CandidateDocumentTable({ documents, candidateId }: CandidateDocumentTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // AlertDialog configuration state
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel?: string;
    onAction: () => void;
    isDestructive?: boolean;
  } | null>(null);

  const handleRename = async (id: string, newName: string) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await renameCandidateDocumentAction({}, { id, fileName: newName, candidateId });
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Document renamed successfully.");
        router.refresh();
      }
    });
  };

  const handleDelete = async (id: string) => {
    setAlertConfig({
      isOpen: true,
      title: "Delete Document",
      description: "Are you sure you want to delete this document? This is a soft delete and can be restored later.",
      actionLabel: "Delete",
      isDestructive: true,
      onAction: () => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          const res = await deleteCandidateDocumentAction({}, { id, candidateId });
          if (res.error) {
            setError(res.error);
          } else {
            setSuccess("Document deleted successfully.");
            router.refresh();
          }
        });
      },
    });
  };

  const handleRestore = async (id: string) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await restoreCandidateDocumentAction({}, { id, candidateId });
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Document restored successfully.");
        router.refresh();
      }
    });
  };

  const handleSetPrimary = async (id: string) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await setPrimaryResumeAction({}, { id, candidateId });
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Primary resume updated successfully.");
        router.refresh();
      }
    });
  };

  const handleReplace = async (id: string, file: File) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("candidateId", candidateId);
      formData.set("replaceDocumentId", id);
      const res = await replaceCandidateResumeAction({}, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("Resume replaced successfully.");
        router.refresh();
      }
    });
  };

  const handleStartImport = async (documentId: string) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await createResumeImportDraftAction(
        {},
        { candidateId, documentId }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.draftId) {
        router.push(
          `/admin/recruitment/candidates/${candidateId}/resume-import/${res.draftId}`
        );
        return;
      }
      setError("Import draft was created but no draft id was returned.");
    });
  };

  if (documents.length === 0) {
    return (
      <CandidateEmptyState
        icon={FileText}
        title="No documents uploaded"
        description="Upload resumes, cover letters, portfolios, or certificates to manage them in one place."
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          {success}
        </p>
      )}

      <div className="border border-border rounded-xl overflow-hidden shadow-subtle bg-card">
        <DataTable
          columns={["Type", "Filename", "Version", "Size", "Uploaded Date", "Actions"]}
        >
          {documents.map((doc) => (
            <CandidateDocumentRow
              key={doc.id}
              doc={doc}
              onRename={handleRename}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onSetPrimary={handleSetPrimary}
              onReplace={handleReplace}
              onStartImport={handleStartImport}
              isPending={isPending}
            />
          ))}
        </DataTable>
      </div>

      {alertConfig && (
        <AlertDialog
          isOpen={alertConfig.isOpen}
          onOpenChange={(open) => setAlertConfig(open ? alertConfig : null)}
          title={alertConfig.title}
          description={alertConfig.description}
          actionLabel={alertConfig.actionLabel}
          isActionDestructive={alertConfig.isDestructive}
          isPending={isPending}
          onAction={() => {
            alertConfig.onAction();
            setAlertConfig(null);
          }}
        />
      )}
    </div>
  );
}
