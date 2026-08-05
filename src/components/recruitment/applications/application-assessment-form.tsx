"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { updateApplicationAssessmentAction } from "@/actions/recruitment-applications";

const ASSESSMENT_MAX_LENGTH = 5000;

export type ApplicationAssessmentFormProps = {
  applicationId: string;
  assessment?: string | null;
  assessmentUpdatedAt?: Date | string | null;
  assessmentUpdatedByEmail?: string | null;
  compact?: boolean;
};

function formatUpdatedAt(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApplicationAssessmentForm({
  applicationId,
  assessment = null,
  assessmentUpdatedAt = null,
  assessmentUpdatedByEmail = null,
  compact = false,
}: ApplicationAssessmentFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(assessment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updatedLabel = formatUpdatedAt(assessmentUpdatedAt);

  const save = () => {
    if (value.trim().length > ASSESSMENT_MAX_LENGTH) {
      setError(`Assessment must be ${ASSESSMENT_MAX_LENGTH} characters or fewer.`);
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await updateApplicationAssessmentAction(
        {},
        { applicationId, assessment: value }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(res.success ?? "Assessment saved.");
      router.refresh();
    });
  };

  return (
    <section className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <h3
          className={
            compact
              ? "text-xs font-bold uppercase tracking-wider text-muted-foreground"
              : "text-sm font-semibold text-foreground"
          }
        >
          Recruiter Assessment
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Role-specific evaluation for this application (not the candidate profile).
        </p>
        {(updatedLabel || assessmentUpdatedByEmail) && (
          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
            Last updated
            {updatedLabel ? `: ${updatedLabel}` : ""}
            {assessmentUpdatedByEmail ? ` · ${assessmentUpdatedByEmail}` : ""}
          </p>
        )}
      </div>

      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
          if (success) setSuccess(null);
        }}
        rows={compact ? 4 : 5}
        maxLength={ASSESSMENT_MAX_LENGTH}
        placeholder="Strengths, gaps, fit for this role, recommendation…"
        disabled={isPending}
        className="resize-y"
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {value.trim().length}/{ASSESSMENT_MAX_LENGTH}
        </p>
        <Button
          type="button"
          size="sm"
          className="font-semibold shadow-subtle"
          disabled={isPending}
          onClick={save}
        >
          {isPending ? "Saving…" : "Save Assessment"}
        </Button>
      </div>

      {error && <ErrorAlert message={error} />}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          {success}
        </p>
      )}
    </section>
  );
}
