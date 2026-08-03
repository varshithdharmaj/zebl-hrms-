"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { FileSpreadsheet, FileText, Loader2, Upload } from "lucide-react";
import { uploadAttendanceAction, type UploadState } from "@/actions/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ATTENDANCE_UPLOAD_MAX_FILE_SIZE } from "@/lib/attendance/import/file-validation";
import { cn } from "@/lib/utils";

const initialState: UploadState = {};

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

function ResultSummary({ state }: { state: UploadState }) {
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
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-foreground sm:grid-cols-4">
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
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="font-semibold">{hasWarnings ? "Partial" : "Success"}</dd>
        </div>
      </dl>
      {state.success && !hasWarnings && (
        <p className="mt-2 text-xs text-success/90">{state.success}</p>
      )}
    </div>
  );
}

export function UploadForm({ defaultDate }: { defaultDate: string }) {
  const [state, formAction, pending] = useActionState(uploadAttendanceAction, initialState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const dateInputId = useId();
  const errorId = useId();
  const helpId = useId();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const displayError = clientError ?? (state.success ? null : state.error) ?? null;
  const showResult = Boolean(state.success);

  function syncFileInput(file: File | null) {
    const input = fileInputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    if (file) transfer.items.add(file);
    input.files = transfer.files;
  }

  // Browser may clear the file input after submit; keep FormData in sync with selection.
  useEffect(() => {
    if (!selectedFile) return;
    const input = fileInputRef.current;
    if (!input) return;
    const current = input.files?.[0];
    if (!current || current.name !== selectedFile.name || current.size !== selectedFile.size) {
      syncFileInput(selectedFile);
    }
  }, [selectedFile, pending, state]);

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
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (pending) return;
    const file = event.dataTransfer.files?.[0] ?? null;
    applyFile(file);
  }

  function onDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (pending) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  }

  const FileIcon = selectedFile
    ? extensionOf(selectedFile.name) === ".pdf"
      ? FileText
      : FileSpreadsheet
    : Upload;

  return (
    <SectionCard
      title="Import file"
      description="XLSX, XLS, or PDF · Maximum 5 MB · Matched by employee code"
      className="max-w-xl"
    >
      <form action={formAction} className="space-y-5" aria-busy={pending}>
        {showResult && <ResultSummary state={state} />}
        {displayError && (
          <div id={errorId}>
            <ErrorAlert message={displayError} />
          </div>
        )}
        {state.success && state.error && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-foreground">
            <p className="font-medium">Warnings</p>
            <p className="mt-1 text-muted-foreground">{state.error}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={dateInputId}>Attendance date</Label>
          <Input
            id={dateInputId}
            name="attendanceDate"
            type="date"
            defaultValue={defaultDate}
            required
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fileInputId}>Attendance file</Label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            name="file"
            type="file"
            accept={ACCEPT}
            required
            disabled={pending}
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
              tabIndex={pending ? -1 : 0}
              aria-controls={fileInputId}
              aria-label="Choose attendance file to upload"
              onKeyDown={onDropzoneKeyDown}
              onClick={() => {
                if (!pending) fileInputRef.current?.click();
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!pending) setDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!pending) setDragActive(true);
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
                pending && "pointer-events-none opacity-60"
              )}
            >
              <Upload className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium text-foreground">
                Drag and drop your attendance file here
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
                pending && "opacity-70"
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
                disabled={pending}
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
              <li>
                Supported PDFs: structured attendance reports with recognizable tabular columns (not
                scanned image-only PDFs).
              </li>
              <li>
                For unsupported or complex PDF reports, export the attendance data as Excel and upload
                the Excel file instead.
              </li>
              <li>
                PDF import only updates existing employees — unknown codes are rejected (Excel may still
                auto-create).
              </li>
              <li>≥ 480 min worked = Present · &lt; 480 min = Short hours · No check-in = Absent</li>
            </ul>
          )}
        </div>

        <Button type="submit" disabled={pending || !selectedFile} aria-disabled={pending || !selectedFile}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              <span>Importing…</span>
              <span className="sr-only">Import in progress</span>
            </>
          ) : (
            "Import Attendance"
          )}
        </Button>
      </form>
    </SectionCard>
  );
}
