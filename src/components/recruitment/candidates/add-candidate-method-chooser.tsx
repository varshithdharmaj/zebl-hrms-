"use client";

import { FileUp, PenLine, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type AddCandidateMethod = "upload" | "manual";

type AddCandidateMethodChooserProps = {
  onSelect: (method: AddCandidateMethod) => void;
};

export function AddCandidateMethodChooser({ onSelect }: AddCandidateMethodChooserProps) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="text-center sm:text-left">
        <h2 className="text-lg font-semibold text-foreground">
          How would you like to add a candidate?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a resume to prepare auto-fill later, or enter details yourself.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("upload")}
          className={cn(
            "group relative flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-subtle",
            "transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            <Sparkles className="h-3 w-3" />
            Recommended
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted shadow-subtle">
            <FileUp className="h-5 w-5 text-foreground" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Upload Resume</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Upload a PDF or DOCX resume to automatically fill candidate details.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelect("manual")}
          className={cn(
            "group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-subtle",
            "transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted shadow-subtle">
            <PenLine className="h-5 w-5 text-foreground" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Create Manually</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Enter candidate details yourself.
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
