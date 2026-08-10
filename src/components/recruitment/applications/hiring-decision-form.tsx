"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HiringDecisionOutcome } from "@/generated/prisma/enums";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/error-alert";
import { submitHiringDecisionAction } from "@/actions/recruitment-decisions";
import type { HiringDecisionRecord } from "@/lib/recruitment/repositories/decision-repository";

const OUTCOME_OPTIONS: ReadonlyArray<{ value: HiringDecisionOutcome; label: string }> = [
  { value: HiringDecisionOutcome.strong_hire, label: "Strong Hire" },
  { value: HiringDecisionOutcome.hire, label: "Hire" },
  { value: HiringDecisionOutcome.borderline, label: "Borderline" },
  { value: HiringDecisionOutcome.hold, label: "Hold" },
  { value: HiringDecisionOutcome.reject, label: "Reject" },
];

export type HiringDecisionFormProps = {
  applicationId: string;
  currentDecision?: HiringDecisionRecord | null;
  compact?: boolean;
};

function formatDecidedAt(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function outcomeLabel(outcome: HiringDecisionOutcome | string): string {
  return OUTCOME_OPTIONS.find((option) => option.value === outcome)?.label ?? String(outcome).replace(/_/g, " ");
}

export function HiringDecisionForm({
  applicationId,
  currentDecision = null,
  compact = false,
}: HiringDecisionFormProps) {
  const router = useRouter();
  const [isRevising, setIsRevising] = useState(!currentDecision);
  const [outcome, setOutcome] = useState<HiringDecisionOutcome>(
    currentDecision?.outcome ?? HiringDecisionOutcome.hire
  );
  const [rationale, setRationale] = useState("");
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const headingClass = compact
    ? "text-xs font-bold uppercase tracking-wider text-muted-foreground"
    : "text-sm font-semibold text-foreground";

  const submit = () => {
    if (!rationale.trim()) {
      setError("Rationale is required.");
      return;
    }
    if (!strengths.trim()) {
      setError("Strengths is required.");
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await submitHiringDecisionAction(
        {},
        {
          applicationId,
          outcome,
          rationale,
          strengths,
          concerns: concerns.trim() || null,
        }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(res.success ?? "Hiring decision submitted.");
      setIsRevising(false);
      setRationale("");
      setStrengths("");
      setConcerns("");
      router.refresh();
    });
  };

  return (
    <section className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <h3 className={headingClass}>Hiring Decision</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Formal hire / hold / reject record for this application. Revisions create a new version.
        </p>
      </div>

      {currentDecision ? (
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
          <p className="text-xs font-semibold text-foreground">
            {outcomeLabel(currentDecision.outcome)}
            <span className="ml-2 font-medium text-muted-foreground">
              · v{currentDecision.version}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Decided by {currentDecision.decidedByEmail ?? currentDecision.decidedByUserId}
            {" · "}
            {formatDecidedAt(currentDecision.decidedAt)}
          </p>
          <p className="text-xs text-foreground whitespace-pre-wrap">
            <span className="font-semibold">Rationale: </span>
            {currentDecision.rationale}
          </p>
          <p className="text-xs text-foreground whitespace-pre-wrap">
            <span className="font-semibold">Strengths: </span>
            {currentDecision.strengths}
          </p>
          {currentDecision.concerns ? (
            <p className="text-xs text-foreground whitespace-pre-wrap">
              <span className="font-semibold">Concerns: </span>
              {currentDecision.concerns}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No hiring decision submitted yet.</p>
      )}

      {currentDecision && !isRevising ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-semibold"
          onClick={() => {
            setIsRevising(true);
            setOutcome(currentDecision.outcome);
            setError(null);
            setSuccess(null);
          }}
        >
          Revise decision
        </Button>
      ) : null}

      {isRevising ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`decision-outcome-${applicationId}`} className="text-xs font-semibold">
              Outcome
            </Label>
            <select
              id={`decision-outcome-${applicationId}`}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={outcome}
              disabled={isPending}
              onChange={(e) => setOutcome(e.target.value as HiringDecisionOutcome)}
            >
              {OUTCOME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`decision-rationale-${applicationId}`} className="text-xs font-semibold">
              Rationale
            </Label>
            <Textarea
              id={`decision-rationale-${applicationId}`}
              value={rationale}
              rows={compact ? 3 : 4}
              disabled={isPending}
              placeholder="Why this outcome?"
              onChange={(e) => {
                setRationale(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`decision-strengths-${applicationId}`} className="text-xs font-semibold">
              Strengths
            </Label>
            <Textarea
              id={`decision-strengths-${applicationId}`}
              value={strengths}
              rows={compact ? 3 : 4}
              disabled={isPending}
              placeholder="Evidence supporting the decision"
              onChange={(e) => {
                setStrengths(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`decision-concerns-${applicationId}`} className="text-xs font-semibold">
              Concerns <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id={`decision-concerns-${applicationId}`}
              value={concerns}
              rows={compact ? 2 : 3}
              disabled={isPending}
              placeholder="Risks or remaining gaps"
              onChange={(e) => setConcerns(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="font-semibold shadow-subtle"
              disabled={isPending}
              onClick={submit}
            >
              {isPending
                ? "Saving…"
                : currentDecision
                  ? "Submit revision"
                  : "Submit decision"}
            </Button>
            {currentDecision ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setIsRevising(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error && <ErrorAlert message={error} />}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          {success}
        </p>
      )}
    </section>
  );
}
