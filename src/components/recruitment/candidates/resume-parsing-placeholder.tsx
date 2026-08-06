"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";

type ResumeParsingPlaceholderProps = {
  fileName: string;
  onContinueToForm: () => void;
  onBackToUpload: () => void;
};

/**
 * Placeholder step between file selection and the candidate form.
 *
 * TODO(resume-parser): Replace this screen with a real parse job:
 *   1. Persist the selected file (or storage key) without creating a Candidate yet
 *   2. Run Resume Parser → Extract Candidate Draft
 *   3. Navigate to Review Screen (HR edits) → Create Candidate
 * Until then we only hand off to the manual form.
 */
export function ResumeParsingPlaceholder({
  fileName,
  onContinueToForm,
  onBackToUpload,
}: ResumeParsingPlaceholderProps) {
  return (
    <SectionCard
      title="Parsing Resume"
      description="Preparing the candidate form. Automatic field extraction is not enabled yet."
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted shadow-subtle">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Resume selected</p>
          <p className="truncate text-xs text-muted-foreground" title={fileName}>
            {fileName}
          </p>
          <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
            {/* TODO(resume-parser): show real parse progress / errors here */}
            Parsing will fill name, contact, experience, and skills in a future release. Continue
            to enter details manually for now — no candidate has been created.
          </p>
        </div>
        <div className="flex w-full flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-center">
          <Button type="button" variant="outline" onClick={onBackToUpload}>
            Back to upload
          </Button>
          <Button
            type="button"
            className="font-semibold shadow-subtle"
            onClick={onContinueToForm}
          >
            Continue to form
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
