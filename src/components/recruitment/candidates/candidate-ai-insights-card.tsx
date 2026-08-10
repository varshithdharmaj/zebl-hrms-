"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorAlert } from "@/components/ui/error-alert";
import { CandidateSection } from "./candidate-section";
import {
  acceptCandidateAiEnrichmentAction,
  dismissCandidateAiEnrichmentAction,
  generateCandidateAiEnrichmentAction,
} from "@/actions/recruitment-ai-enrichment";
import type { CandidateEnrichmentInsightContent } from "@/lib/recruitment/ai/types";

export type CandidateAiInsightCardProps = {
  candidateId: string;
  insightId: string | null;
  status: string | null;
  content: CandidateEnrichmentInsightContent | null;
  sourceDraftId: string | null;
  canManage: boolean;
  profileHeadline: string | null;
  profileSummary: string | null;
  /** Server-computed: insight fingerprint no longer matches current profile/draft. */
  isStale?: boolean;
};

export function CandidateAiInsightsCard({
  candidateId,
  insightId,
  status,
  content,
  sourceDraftId,
  canManage,
  profileHeadline,
  profileSummary,
  isStale = false,
}: CandidateAiInsightCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingHeadline, setEditingHeadline] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(content?.enrichment.summary ?? "");
  const [headlineDraft, setHeadlineDraft] = useState(content?.enrichment.headline ?? "");

  const enrichment = content?.enrichment;
  const headlineFilled = Boolean(profileHeadline?.trim());
  const summaryFilled = Boolean(profileSummary?.trim());
  const canAccept = canManage && status === "pending_review" && !isStale;

  function runAccept(opts: {
    acceptSummary?: boolean;
    acceptHeadline?: boolean;
  }) {
    if (!insightId || isStale) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await acceptCandidateAiEnrichmentAction(
        {},
        {
          candidateId,
          insightId,
          acceptSummary: opts.acceptSummary,
          acceptHeadline: opts.acceptHeadline,
          replaceSummary:
            opts.acceptSummary && summaryFilled ? true : undefined,
          replaceHeadline:
            opts.acceptHeadline && headlineFilled ? true : undefined,
          editedSummary: opts.acceptSummary ? summaryDraft : undefined,
          editedHeadline: opts.acceptHeadline ? headlineDraft : undefined,
        }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(res.success ?? "Applied.");
      setEditingHeadline(false);
      setEditingSummary(false);
      router.refresh();
    });
  }

  function runDismiss() {
    if (!insightId) return;
    setError(null);
    startTransition(async () => {
      const res = await dismissCandidateAiEnrichmentAction(
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

  function runGenerate() {
    if (!sourceDraftId) {
      setError("Upload or import a resume first to generate AI insights.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await generateCandidateAiEnrichmentAction(
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

  return (
    <CandidateSection
      title="AI Insights"
      description="AI Suggested — review before applying to the profile."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            AI Suggested
          </span>
          {status ? (
            <span className="text-[11px] text-muted-foreground capitalize">
              {String(status).replaceAll("_", " ")}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">No insight yet</span>
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
              {enrichment ? "Regenerate" : "Generate"}
            </Button>
          ) : null}
        </div>

        {error ? <ErrorAlert message={error} /> : null}
        {success ? (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {success}
          </p>
        ) : null}

        {isStale && enrichment ? (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-200"
          >
            AI suggestion is based on an older profile or resume. Regenerate before
            applying.
          </div>
        ) : null}

        {!enrichment ? (
          <p className="text-sm text-muted-foreground">
            AI enrichment runs after resume import when enabled. You can also generate
            manually once a resume draft exists.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Headline suggestion
                </p>
                {canAccept ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={isPending}
                      onClick={() => {
                        setEditingHeadline((v) => !v);
                        setHeadlineDraft(enrichment.headline);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] font-semibold"
                      disabled={isPending}
                      onClick={() => runAccept({ acceptHeadline: true })}
                    >
                      {headlineFilled ? "Replace headline" : "Accept headline"}
                    </Button>
                  </div>
                ) : null}
              </div>
              {editingHeadline && canAccept ? (
                <Textarea
                  value={headlineDraft}
                  onChange={(e) => setHeadlineDraft(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm font-medium text-foreground">{enrichment.headline}</p>
              )}
              {headlineFilled && !isStale ? (
                <p className="text-[11px] text-muted-foreground">
                  Profile already has a headline — accept only if you want to replace it.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Professional summary
                </p>
                {canAccept ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={isPending}
                      onClick={() => {
                        setEditingSummary((v) => !v);
                        setSummaryDraft(enrichment.summary);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] font-semibold"
                      disabled={isPending}
                      onClick={() => runAccept({ acceptSummary: true })}
                    >
                      {summaryFilled ? "Replace summary" : "Accept summary"}
                    </Button>
                  </div>
                ) : null}
              </div>
              {editingSummary && canAccept ? (
                <Textarea
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  rows={5}
                  className="text-sm"
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {enrichment.summary}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Key strengths
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                {enrichment.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Missing information
              </p>
              {enrichment.missingInformation.length === 0 ? (
                <p className="text-sm text-muted-foreground">None flagged.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                  {enrichment.missingInformation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground">
                Inferred gaps from the profile — AI does not invent CTC or notice values.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Suggested interview topics
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                {enrichment.interviewTopics.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            {canManage && status === "pending_review" ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {canAccept ? (
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs font-semibold"
                    disabled={isPending}
                    onClick={() =>
                      runAccept({ acceptSummary: true, acceptHeadline: true })
                    }
                  >
                    Accept summary & headline
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  disabled={isPending}
                  onClick={runDismiss}
                >
                  Dismiss
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </CandidateSection>
  );
}
