"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { FileSpreadsheet, FileText, Upload } from "lucide-react";
import {
  cancelAttendancePreviewAction,
  confirmAttendanceImportAction,
  previewAttendanceAction,
  type ConfirmActionState,
  type PreviewActionState,
} from "@/actions/upload-preview";
import { AttendanceDateDetectionPanel } from "@/components/admin/attendance-date-detection-panel";
import { AttendanceImportPreviewPanel } from "@/components/admin/attendance-import-preview-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceReportDetection } from "@/hooks/use-attendance-report-detection";
import { ATTENDANCE_UPLOAD_MAX_FILE_SIZE } from "@/lib/attendance/import/file-validation";
import type { AttendanceImportPreview } from "@/lib/attendance/import/preview-types";
import { cn } from "@/lib/utils";

const ACCEPT =
  ".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".pdf"] as const;

function extensionOf(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot === -1 ? "" : lower.slice(dot);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(name: string): string {
  const ext = extensionOf(name).replace(".", "").toUpperCase();
  return ext || "FILE";
}

function validateSelectedFile(file: File): string | null {
  if (file.size === 0) {
    return "The selected file is empty. Please choose a valid Excel or PDF attendance file.";
  }
  if (file.size > ATTENDANCE_UPLOAD_MAX_FILE_SIZE) {
    return "File size exceeds 5 MB. Please upload a smaller file.";
  }
  const ext = extensionOf(file.name);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return "Unsupported file type. Please upload an XLSX, XLS, or PDF file.";
  }
  return null;
}

function ImportResultPanel({ state }: { state: ConfirmActionState }) {
  const imported = state.imported ?? 0;
  const skipped = state.skipped ?? 0;
  const unknown = state.unknownEmployees ?? 0;
  const hasWarnings = Boolean(state.error && state.success);

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        hasWarnings
          ? "border-amber-500/25 bg-amber-500/5 text-foreground"
          : "border-success/20 bg-success-muted text-success"
      )}
      role="status"
      aria-live="polite"
    >
      <p className="font-medium">
        {hasWarnings ? "Import completed with warnings" : "Import completed"}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-foreground sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <dt className="text-xs text-muted-foreground">Imported</dt>
          <dd className="font-semibold tabular-nums">{imported}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Duplicates skipped</dt>
          <dd className="font-semibold tabular-nums">{skipped}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Unknown employees</dt>
          <dd className="font-semibold tabular-nums">{unknown}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Duration</dt>
          <dd className="font-semibold tabular-nums">
            {state.durationMs != null ? `${(state.durationMs / 1000).toFixed(1)}s` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Report</dt>
          <dd className="font-semibold">{state.reportType ?? "—"}</dd>
        </div>
      </dl>
      {state.datesImported && state.datesImported.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Attendance dates imported: {state.datesImported.slice(0, 8).join(", ")}
          {state.datesImported.length > 8 ? ` (+${state.datesImported.length - 8} more)` : ""}
        </p>
      )}
      {state.success && !hasWarnings && (
        <p className="mt-2 text-xs text-success/90">{state.success}</p>
      )}
      {hasWarnings && state.error && (
        <p className="mt-2 text-xs text-muted-foreground">{state.error}</p>
      )}
    </div>
  );
}

type Step = "upload" | "preview" | "done";

export function UploadFormPreview({ defaultDate }: { defaultDate: string }) {
  const [previewState, previewAction, previewPending] = useActionState(
    previewAttendanceAction,
    {} as PreviewActionState
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmAttendanceImportAction,
    {} as ConfirmActionState
  );
  const [, startCancelTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewFormRef = useRef<HTMLFormElement>(null);
  const confirmFocusRef = useRef<HTMLDivElement>(null);
  const fileInputId = useId();
  const dateInputId = useId();
  const errorId = useId();
  const helpId = useId();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(defaultDate);
  const [clientError, setClientError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [preview, setPreview] = useState<AttendanceImportPreview | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const detection = useAttendanceReportDetection(selectedFile);

  // Sync preview action result into local step state
  useEffect(() => {
    if (previewState.preview) {
      setPreview(previewState.preview);
      setStep("preview");
      setClientError(null);
    }
  }, [previewState.preview]);

  useEffect(() => {
    if (confirmState.success) {
      setStep("done");
      setPreview(null);
      setSelectedFile(null);
      syncFileInput(null);
      confirmFocusRef.current?.focus();
    }
  }, [confirmState.success]);

  const detecting = detection.status === "detecting";
  const canPreview = Boolean(selectedFile) && !previewPending && !confirmPending && !detecting;

  const displayError =
    clientError ??
    (step === "upload" ? previewState.error : null) ??
    (step === "preview" && !confirmState.success ? confirmState.error : null) ??
    null;

  function syncFileInput(file: File | null) {
    const input = fileInputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    if (file) transfer.items.add(file);
    input.files = transfer.files;
  }

  useEffect(() => {
    if (!selectedFile) return;
    const input = fileInputRef.current;
    if (!input) return;
    const current = input.files?.[0];
    if (!current || current.name !== selectedFile.name || current.size !== selectedFile.size) {
      syncFileInput(selectedFile);
    }
  }, [selectedFile, previewPending, previewState]);

  function applyFile(file: File | null) {
    if (!file) {
      syncFileInput(null);
      setSelectedFile(null);
      setClientError(null);
      return;
    }
    const validationError = validateSelectedFile(file);
    if (validationError) {
      syncFileInput(null);
      setSelectedFile(null);
      setClientError(validationError);
      return;
    }
    syncFileInput(file);
    setSelectedFile(file);
    setClientError(null);
    setStep("upload");
    setPreview(null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (previewPending || confirmPending) return;
    applyFile(event.dataTransfer.files?.[0] ?? null);
  }

  function onDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (previewPending || confirmPending) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  }

  function resetToUpload() {
    const previewId = preview?.previewId;
    setPreview(null);
    setStep("upload");
    setClientError(null);
    if (previewId) {
      const fd = new FormData();
      fd.set("previewId", previewId);
      startCancelTransition(() => {
        void cancelAttendancePreviewAction({}, fd);
      });
    }
  }

  function handleConfirm() {
    if (!preview) return;
    const fd = new FormData();
    fd.set("previewId", preview.previewId);
    confirmAction(fd);
  }

  const FileIcon = selectedFile
    ? extensionOf(selectedFile.name) === ".pdf"
      ? FileText
      : FileSpreadsheet
    : Upload;

  const busy = previewPending || confirmPending;

  if (step === "done" && confirmState.success) {
    return (
      <SectionCard
        title="Import complete"
        description="Attendance records were written successfully."
        className="max-w-3xl"
      >
        <div ref={confirmFocusRef} tabIndex={-1} className="outline-none">
          <ImportResultPanel state={confirmState} />
        </div>
        <div className="mt-4">
          <Button
            type="button"
            onClick={() => {
              setStep("upload");
              setSelectedFile(null);
              syncFileInput(null);
            }}
          >
            Import another file
          </Button>
        </div>
      </SectionCard>
    );
  }

  if (step === "preview" && preview) {
    return (
      <div className="max-w-5xl space-y-4">
        {displayError && !confirmPending && (
          <div id={errorId}>
            <ErrorAlert message={displayError} />
          </div>
        )}
        <AttendanceImportPreviewPanel
          preview={preview}
          confirming={confirmPending}
          onConfirm={handleConfirm}
          onCancel={resetToUpload}
        />
      </div>
    );
  }

  return (
    <SectionCard
      title="Import file"
      description="Preview and validate before writing attendance records"
      className="max-w-xl"
    >
      <form
        ref={previewFormRef}
        action={previewAction}
        className="space-y-5"
        aria-busy={busy}
      >
        {displayError && (
          <div id={errorId}>
            <ErrorAlert message={displayError} />
          </div>
        )}

        {previewPending && (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            <p className="text-sm text-muted-foreground">Parsing and validating…</p>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={fileInputId}>Attendance file</Label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            name="file"
            type="file"
            accept={ACCEPT}
            required
            disabled={busy}
            className="sr-only"
            aria-describedby={`${helpId}${displayError ? ` ${errorId}` : ""}`}
            aria-invalid={displayError ? true : undefined}
            onChange={(event) => {
              applyFile(event.target.files?.[0] ?? null);
            }}
          />

          {!selectedFile ? (
            <div
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-controls={fileInputId}
              aria-label="Choose attendance file to upload"
              onKeyDown={onDropzoneKeyDown}
              onClick={() => {
                if (!busy) fileInputRef.current?.click();
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!busy) setDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!busy) setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragActive(false);
              }}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
                busy && "pointer-events-none opacity-60"
              )}
            >
              <Upload className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium text-foreground">
                Drop Excel or PDF here…
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                or{" "}
                <span className="font-medium text-primary underline-offset-2 hover:underline">
                  Browse files
                </span>
              </p>
              <p id={helpId} className="mt-3 text-xs text-muted-foreground">
                XLSX, XLS, or PDF · Maximum 5 MB
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3",
                busy && "opacity-70"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                <FileIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fileTypeLabel(selectedFile.name)} · {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  applyFile(null);
                  fileInputRef.current?.click();
                }}
              >
                Change file
              </Button>
            </div>
          )}
        </div>

        <AttendanceDateDetectionPanel
          hasFile={Boolean(selectedFile)}
          detection={detection}
          dateInputId={dateInputId}
          attendanceDate={attendanceDate}
          onAttendanceDateChange={setAttendanceDate}
          disabled={busy}
        />

        <div className="space-y-2">
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            aria-expanded={notesOpen}
            onClick={() => setNotesOpen((open) => !open)}
          >
            {notesOpen ? "Hide import notes" : "Show import notes"}
          </button>
          {notesOpen && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>Files are parsed and validated before any database writes.</li>
              <li>
                Summary PDFs import per-row dates from the file. Daily reports require an attendance
                date after the file is analyzed.
              </li>
              <li>
                Unknown employee codes are auto-created on import with login
                {" "}
                <span className="font-mono">{`{code}@zebl.com`}</span> and the default upload
                password.
              </li>
            </ul>
          )}
        </div>

        <Button
          type="submit"
          loading={previewPending}
          disabled={!canPreview && !previewPending}
          aria-disabled={!canPreview}
        >
          {previewPending ? "Preparing preview…" : "Preview import"}
        </Button>
      </form>
    </SectionCard>
  );
}
