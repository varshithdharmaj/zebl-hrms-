"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorAlert } from "@/components/ui/error-alert";
import { CandidateSection } from "./candidate-section";
import {
  acceptCandidateAiRecoveryAction,
  dismissCandidateAiRecoveryAction,
  generateCandidateAiRecoveryAction,
} from "@/actions/recruitment-ai-recovery";
import type {
  RecoveryFieldKey,
  ResumeFieldRecoveryInsightContent,
} from "@/lib/recruitment/ai/recovery-types";

const FIELD_LABELS: Record<RecoveryFieldKey, string> = {
  location: "Location",
  headline: "Headline",
  professionalSummary: "Professional summary",
  githubUrl: "GitHub URL",
  linkedinUrl: "LinkedIn URL",
  portfolioUrl: "Portfolio URL",
  experience: "Experience",
  education: "Education",
  skill: "Skill",
  project: "Project",
  certification: "Certification",
};

function formatProposalValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value ?? "");
}

export type CandidateAiRecoveryCardProps = {
  candidateId: string;
  insightId: string | null;
  status: string | null;
  content: ResumeFieldRecoveryInsightContent | null;
  sourceDraftId: string | null;
  canManage: boolean;
  isStale?: boolean;
};

export function CandidateAiRecoveryCard({
  candidateId,
  insightId,
  status,
  content,
  sourceDraftId,
  canManage,
  isStale = false,
}: CandidateAiRecoveryCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const pendingProposals = useMemo(
    () => (content?.proposals ?? []).filter((p) => !p.applied),
    [content?.proposals]
  );
  const canAct = canManage && status === "pending_review" && !isStale;

  function runGenerate() {
    if (!sourceDraftId) {
      setError("Upload or import a resume first to generate field recovery.");
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await generateCandidateAiRecoveryAction(
        {},
        { candidateId, sourceDraftId, force: true }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(res.success ?? "Generated.");
      router.refresh();
    });
  }

  function runDismiss() {
    if (!insightId) return;
    setError(null);
    startTransition(async () => {
      const res = await dismissCandidateAiRecoveryAction(
        {},
        { candidateId, insightId }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(res.success ?? "Dismissed.");
      router.refresh();
    });
  }

  function runAccept(proposalId: string, edited?: string) {
    if (!insightId || isStale) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const editedValues =
        edited !== undefined
          ? {
              [proposalId]: (() => {
                try {
                  return JSON.parse(edited) as unknown;
                } catch {
                  return edited;
                }
              })(),
            }
          : undefined;
      const res = await acceptCandidateAiRecoveryAction(
        {},
        {
          candidateId,
          insightId,
          proposalIds: [proposalId],
          editedValues,
        }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(res.success ?? "Applied.");
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <CandidateSection
      title="AI Field Recovery"
      description="Recovered from resume evidence — review before applying. Not verified until accepted."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            AI Field Recovery
          </span>
          {status ? (
            <span className="text-[11px] text-muted-foreground capitalize">
              {String(status).replaceAll("_", " ")}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">No proposals yet</span>
          )}
          {isStale ? (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-200">
              Outdated
            </span>
          ) : null}
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto text-xs font-semibold"
              disabled={isPending || !sourceDraftId}
              onClick={runGenerate}
            >
              {content ? "Regenerate" : "Generate"}
            </Button>
          ) : null}
        </div>

        {error ? <ErrorAlert message={error} /> : null}
        {success ? (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {success}
          </p>
        ) : null}

        {isStale && content ? (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-200"
          >
            Field recovery is based on an older profile or resume. Regenerate before
            applying.
          </div>
        ) : null}

        {!content || pendingProposals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            When resume import leaves empty profile fields, AI may propose
            evidence-backed recoveries here. Nothing is written until you accept.
          </p>
        ) : (
          <ul className="space-y-3">
            {pendingProposals.map((proposal) => {
              const label = FIELD_LABELS[proposal.field] ?? proposal.field;
              const isEditing = editingId === proposal.id;
              const valueText = formatProposalValue(proposal.value);
              return (
                <li
                  key={proposal.id}
                  className="space-y-2 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </p>
                    <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {proposal.confidence}
                    </span>
                  </div>
                  {isEditing && canAct ? (
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={4}
                      className="font-mono text-xs"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap break-words text-sm text-foreground">
                      {valueText}
                    </pre>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Evidence: {proposal.evidence}
                  </p>
                  {canAct ? (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] font-semibold"
                        disabled={isPending}
                        onClick={() =>
                          runAccept(
                            proposal.id,
                            isEditing ? editDraft : undefined
                          )
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        disabled={isPending}
                        onClick={() => {
                          if (isEditing) {
                            setEditingId(null);
                            return;
                          }
                          setEditingId(proposal.id);
                          setEditDraft(valueText);
                        }}
                      >
                        {isEditing ? "Cancel edit" : "Edit"}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {canManage && status === "pending_review" && content ? (
          <div className="pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              disabled={isPending}
              onClick={runDismiss}
            >
              Dismiss all
            </Button>
          </div>
        ) : null}
      </div>
    </CandidateSection>
  );
}
