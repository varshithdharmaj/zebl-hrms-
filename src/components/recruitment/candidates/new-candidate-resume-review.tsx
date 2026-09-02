"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  FileWarning,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/ui/section-card";
import { cn } from "@/lib/utils";
import { createCandidateFromResumeReviewAction } from "@/actions/recruitment-new-candidate-resume";
import type { NewCandidateResumeReviewDraft } from "@/lib/recruitment/services/create-candidate-from-resume-service";
import {
  mapParsedDraftToReviewDefaults,
  stripDeniedFieldsFromReviewPayload,
} from "@/lib/recruitment/resume-import/map-new-candidate-review";
import type { CreateCandidateFromResumeReviewInput } from "@/lib/validation/schemas/recruitment/new-candidate-resume";

type Props = {
  draft: NewCandidateResumeReviewDraft;
  /** Original in-memory file — used for the left-pane preview only, never re-uploaded. */
  file: File | null;
  onBack: () => void;
  onContinueManual: () => void;
};

// ---------------------------------------------------------------------------
// Field-path highlighting — extractionMeta.fieldsRequiringReview is a flat
// list of dot/bracket paths the model was uncertain about. Normalize both
// forms ("experience[0].endDate" and "experiences.0.endDate") so matching
// doesn't depend on exactly which style the model used.
// ---------------------------------------------------------------------------

function normalizeFieldPath(path: string): string {
  return path
    .trim()
    .toLowerCase()
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/^experience\./, "experiences.")
    .replace(/^education\./, "educations.")
    .replace(/^skill\./, "skills.")
    .replace(/^project\./, "projects.")
    .replace(/^certification\./, "certifications.");
}

function useFlaggedFieldSet(paths: string[] | undefined): Set<string> {
  return useMemo(() => new Set((paths ?? []).map(normalizeFieldPath)), [paths]);
}

function isFlagged(flagged: Set<string>, path: string): boolean {
  return flagged.has(normalizeFieldPath(path));
}

// ---------------------------------------------------------------------------
// Shared field primitives
// ---------------------------------------------------------------------------

function Field({
  label,
  path,
  flagged,
  children,
}: {
  label: string;
  /** Dot-path into the LLM response, e.g. "experiences.0.endDate". Omit for fields that are never flagged. */
  path?: string;
  flagged?: Set<string>;
  children: React.ReactNode;
}) {
  const needsReview = path && flagged ? isFlagged(flagged, path) : false;
  return (
    <div
      className={cn(
        "space-y-1.5 rounded-md",
        needsReview && "-ml-2.5 border-l-2 border-warning bg-warning-muted/40 pl-2"
      )}
    >
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {needsReview && (
          <span
            title="Requires review — the AI parser was not confident about this field"
            className="inline-flex items-center gap-0.5 rounded-full bg-warning-muted px-1.5 py-0.5 text-[10px] font-medium text-warning"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            Verify
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left pane — document preview (client-side object URL, no server round trip)
// ---------------------------------------------------------------------------

function DocumentPreviewPane({ file, fileName }: { file: File | null; fileName: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isPdf =
    file?.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-muted/10">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="truncate text-xs font-medium text-foreground">{fileName}</p>
      </div>
      <div className="min-h-0 flex-1 bg-background">
        {objectUrl && isPdf ? (
          <iframe src={objectUrl} title={fileName} className="h-full w-full" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <FileWarning className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">
              Preview isn&apos;t available for this file type.
              <br />
              Cross-check details against the original document.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right pane — static AI insights (never mutated by field edits in the middle pane)
// ---------------------------------------------------------------------------

function MatchScoreGauge({ value }: { value: number | null }) {
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  if (value === null) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-1">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-border"
          />
        </svg>
        <p className="text-center text-[11px] leading-tight text-muted-foreground">
          Not scored —<br />no job description supplied
        </p>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);
  const band =
    clamped >= 75 ? "text-success" : clamped >= 50 ? "text-warning" : "text-danger";

  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-border"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(band, "transition-[stroke-dashoffset] duration-500")}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-lg font-semibold text-foreground">{clamped}</span>
        </div>
      </div>
      <p className="text-[11px] font-medium text-muted-foreground">Match score</p>
    </div>
  );
}

function InsightChipList({
  items,
  tone,
}: {
  items: string[];
  tone: "success" | "warning" | "accent-blue";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/20 bg-success-muted text-success"
      : tone === "warning"
        ? "border-warning/20 bg-warning-muted text-warning"
        : "border-accent-blue/20 bg-accent-blue-muted text-accent-blue";

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">None flagged.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li
          key={i}
          className={cn(
            "rounded-md border px-2 py-1 text-xs leading-snug",
            toneClass
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function AiInsightsPane({ draft }: { draft: NewCandidateResumeReviewDraft }) {
  const insights = draft.aiInsights;
  const documentQuality = draft.extractionMeta?.documentQuality ?? null;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent-violet" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
      </div>

      {!insights || documentQuality === "image_only" ? (
        <p className="text-xs text-muted-foreground">
          No insights were generated for this document.
        </p>
      ) : (
        <>
          <MatchScoreGauge value={insights.matchScore.value} />
          {insights.matchScore.rationale && (
            <p className="-mt-3 text-center text-[11px] text-muted-foreground">
              {insights.matchScore.rationale}
            </p>
          )}

          <section className="space-y-1.5">
            <h4 className="text-xs font-semibold text-foreground">Executive summary</h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {insights.executiveSummary ?? "Not available."}
            </p>
          </section>

          <section className="space-y-1.5">
            <h4 className="text-xs font-semibold text-foreground">Strengths</h4>
            <InsightChipList items={insights.strengths} tone="success" />
          </section>

          <section className="space-y-1.5">
            <h4 className="text-xs font-semibold text-foreground">Gaps</h4>
            <InsightChipList items={insights.gaps} tone="warning" />
          </section>

          <section className="space-y-1.5">
            <h4 className="text-xs font-semibold text-foreground">Clarification flags</h4>
            <InsightChipList items={insights.clarificationFlags} tone="accent-blue" />
          </section>
        </>
      )}

      <p className="mt-auto border-t border-border pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        Generated once, from the original document. Editing fields to the left does not
        regenerate these insights.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NewCandidateResumeReview({ draft, file, onBack, onContinueManual }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duplicateCandidateId, setDuplicateCandidateId] = useState<string | null>(null);

  const initial = useMemo(
    () => mapParsedDraftToReviewDefaults(draft.intakeId, draft.mapped),
    [draft.intakeId, draft.mapped]
  );

  const [form, setForm] = useState<CreateCandidateFromResumeReviewInput>(initial);
  const flagged = useFlaggedFieldSet(draft.extractionMeta?.fieldsRequiringReview);

  const documentQuality = draft.extractionMeta?.documentQuality ?? null;
  const showDegradedBanner =
    !draft.parseOk || documentQuality === "image_only" || documentQuality === "degraded";

  function updateCandidate(
    patch: Partial<CreateCandidateFromResumeReviewInput["candidate"]>
  ) {
    setForm((prev) => ({
      ...prev,
      candidate: { ...prev.candidate, ...patch },
    }));
  }

  function handleCreate() {
    setError(null);
    setDuplicateCandidateId(null);
    startTransition(async () => {
      const payload = stripDeniedFieldsFromReviewPayload(form);
      const result = await createCandidateFromResumeReviewAction({}, payload);
      if (result.error || !result.candidateId) {
        setError(result.error ?? "Could not create candidate.");
        setDuplicateCandidateId(result.duplicateCandidateId ?? null);
        return;
      }
      const notice = result.resumeAttached === false ? "?notice=resume-attach-failed" : "";
      router.push(`/admin/recruitment/candidates/${result.candidateId}${notice}`);
    });
  }

  if (!draft.parseOk && documentQuality !== "image_only") {
    // Hard failure (LLM/API error, malformed response) — no salvageable data at all.
    return (
      <SectionCard
        title="Could not extract resume text"
        description="Something went wrong while analyzing this document."
      >
        <div className="mx-auto w-full max-w-lg space-y-4">
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-muted p-3 text-xs text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {draft.errorNote ??
                "Could not extract readable text from this resume. Please enter candidate details manually."}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            File: <span className="font-medium text-foreground">{draft.fileName}</span>
          </p>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={onBack}>
              Back to upload
            </Button>
            <Button type="button" onClick={onContinueManual}>
              Enter details manually
            </Button>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Review extracted information"
      description="AI-extracted from the document in one pass. Review before creating the candidate — editing a field does not re-run the AI."
      noPadding
      contentClassName="p-4"
    >
      <div className="space-y-4">
        {showDegradedBanner && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-muted p-3 text-xs text-warning"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {documentQuality === "image_only"
                ? "Could not automatically read text from this file — please verify or enter candidate details manually."
                : "Some fields may be unreliable — this document was hard to parse cleanly (styling, layout, or scan quality). Fields needing a closer look are marked below."}
            </span>
          </div>
        )}

        {error ? (
          <div className="space-y-2">
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-muted p-3 text-xs text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            {duplicateCandidateId ? (
              <Button asChild variant="outline" size="sm" className="font-semibold">
                <Link href={`/admin/recruitment/candidates/${duplicateCandidateId}`}>
                  Open Existing Candidate
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}

        {draft.warnings.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Notes: {draft.warnings.slice(0, 3).join(" · ")}
          </p>
        )}

        {/* Three-pane layout: 40% document / 35% form / 25% AI insights on desktop, stacked below lg. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[40%_35%_25%] lg:items-start">
          <div className="h-[70vh] lg:sticky lg:top-4">
            <DocumentPreviewPane file={file} fileName={draft.fileName} />
          </div>

          <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Basic information</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name *" path="fullname" flagged={flagged}>
                  <Input
                    value={form.candidate.fullName ?? ""}
                    onChange={(e) => updateCandidate({ fullName: e.target.value })}
                    disabled={pending}
                  />
                </Field>
                <Field label="Email" path="email" flagged={flagged}>
                  <Input
                    type="email"
                    value={form.candidate.email ?? ""}
                    onChange={(e) => updateCandidate({ email: e.target.value || null })}
                    disabled={pending}
                  />
                </Field>
                <Field label="Phone" path="phone" flagged={flagged}>
                  <Input
                    value={form.candidate.phone ?? ""}
                    onChange={(e) => updateCandidate({ phone: e.target.value || null })}
                    disabled={pending}
                    placeholder="+91..."
                  />
                </Field>
                <Field label="Location" path="location" flagged={flagged}>
                  <Input
                    value={form.candidate.location ?? ""}
                    onChange={(e) => updateCandidate({ location: e.target.value || null })}
                    disabled={pending}
                  />
                </Field>
                <Field label="LinkedIn" path="linkedinurl" flagged={flagged}>
                  <Input
                    value={form.candidate.linkedinUrl ?? ""}
                    onChange={(e) => updateCandidate({ linkedinUrl: e.target.value || null })}
                    disabled={pending}
                  />
                </Field>
                <Field label="GitHub" path="githuburl" flagged={flagged}>
                  <Input
                    value={form.candidate.githubUrl ?? ""}
                    onChange={(e) => updateCandidate({ githubUrl: e.target.value || null })}
                    disabled={pending}
                  />
                </Field>
                <Field label="Portfolio" path="portfoliourl" flagged={flagged}>
                  <Input
                    value={form.candidate.portfolioUrl ?? ""}
                    onChange={(e) => updateCandidate({ portfolioUrl: e.target.value || null })}
                    disabled={pending}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Professional</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Headline" path="headline" flagged={flagged}>
                  <Input
                    value={form.candidate.headline ?? ""}
                    onChange={(e) => updateCandidate({ headline: e.target.value || null })}
                    disabled={pending}
                  />
                </Field>
                <Field
                  label="Total experience (years)"
                  path="totalexperienceyears"
                  flagged={flagged}
                >
                  <Input
                    value={form.candidate.totalExperienceYears ?? ""}
                    onChange={(e) =>
                      updateCandidate({ totalExperienceYears: e.target.value || null })
                    }
                    disabled={pending}
                  />
                </Field>
                <Field label="Current company" path="currentcompany" flagged={flagged}>
                  <Input
                    value={form.candidate.currentCompany ?? ""}
                    onChange={(e) =>
                      updateCandidate({ currentCompany: e.target.value || null })
                    }
                    disabled={pending}
                  />
                </Field>
                <Field label="Current title" path="currenttitle" flagged={flagged}>
                  <Input
                    value={form.candidate.currentTitle ?? ""}
                    onChange={(e) => updateCandidate({ currentTitle: e.target.value || null })}
                    disabled={pending}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field
                    label="Summary"
                    path="professionalsummary"
                    flagged={flagged}
                  >
                    <Textarea
                      value={form.candidate.professionalSummary ?? ""}
                      onChange={(e) =>
                        updateCandidate({ professionalSummary: e.target.value || null })
                      }
                      disabled={pending}
                      rows={4}
                    />
                  </Field>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Experience</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      experiences: [
                        ...prev.experiences,
                        { company: "", title: "", isCurrent: false },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              {form.experiences.length === 0 && (
                <p className="text-xs text-muted-foreground">No experience extracted.</p>
              )}
              <div className="space-y-3">
                {form.experiences.map((row, index) => (
                  <div
                    key={`exp-${index}`}
                    className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
                  >
                    <Field
                      label="Company"
                      path={`experiences.${index}.company`}
                      flagged={flagged}
                    >
                      <Input
                        value={row.company}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const experiences = [...prev.experiences];
                            experiences[index] = { ...experiences[index]!, company: e.target.value };
                            return { ...prev, experiences };
                          })
                        }
                      />
                    </Field>
                    <Field label="Title" path={`experiences.${index}.title`} flagged={flagged}>
                      <Input
                        value={row.title}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const experiences = [...prev.experiences];
                            experiences[index] = { ...experiences[index]!, title: e.target.value };
                            return { ...prev, experiences };
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Start"
                      path={`experiences.${index}.startdate`}
                      flagged={flagged}
                    >
                      <Input
                        value={row.startDate ?? ""}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const experiences = [...prev.experiences];
                            experiences[index] = {
                              ...experiences[index]!,
                              startDate: e.target.value || null,
                            };
                            return { ...prev, experiences };
                          })
                        }
                      />
                    </Field>
                    <Field label="End" path={`experiences.${index}.enddate`} flagged={flagged}>
                      <Input
                        value={row.endDate ?? ""}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const experiences = [...prev.experiences];
                            experiences[index] = {
                              ...experiences[index]!,
                              endDate: e.target.value || null,
                            };
                            return { ...prev, experiences };
                          })
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field
                        label="Description"
                        path={`experiences.${index}.description`}
                        flagged={flagged}
                      >
                        <Textarea
                          value={row.description ?? ""}
                          disabled={pending}
                          rows={2}
                          onChange={(e) =>
                            setForm((prev) => {
                              const experiences = [...prev.experiences];
                              experiences[index] = {
                                ...experiences[index]!,
                                description: e.target.value || null,
                              };
                              return { ...prev, experiences };
                            })
                          }
                        />
                      </Field>
                    </div>
                    <div className="flex justify-end sm:col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        className="text-danger"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            experiences: prev.experiences.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Education</h3>
              {form.educations.length === 0 && (
                <p className="text-xs text-muted-foreground">No education extracted.</p>
              )}
              <div className="space-y-3">
                {form.educations.map((row, index) => (
                  <div
                    key={`edu-${index}`}
                    className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
                  >
                    <Field
                      label="Institution"
                      path={`educations.${index}.institution`}
                      flagged={flagged}
                    >
                      <Input
                        value={row.institution}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const educations = [...prev.educations];
                            educations[index] = {
                              ...educations[index]!,
                              institution: e.target.value,
                            };
                            return { ...prev, educations };
                          })
                        }
                      />
                    </Field>
                    <Field label="Degree" path={`educations.${index}.degree`} flagged={flagged}>
                      <Input
                        value={row.degree ?? ""}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const educations = [...prev.educations];
                            educations[index] = { ...educations[index]!, degree: e.target.value || null };
                            return { ...prev, educations };
                          })
                        }
                      />
                    </Field>
                    <Field label="Field" path={`educations.${index}.field`} flagged={flagged}>
                      <Input
                        value={row.field ?? ""}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const educations = [...prev.educations];
                            educations[index] = { ...educations[index]!, field: e.target.value || null };
                            return { ...prev, educations };
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Graduation year"
                      path={`educations.${index}.endyear`}
                      flagged={flagged}
                    >
                      <Input
                        type="number"
                        value={row.endYear ?? ""}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const educations = [...prev.educations];
                            const n = e.target.value ? Number.parseInt(e.target.value, 10) : null;
                            educations[index] = {
                              ...educations[index]!,
                              endYear: Number.isFinite(n) ? n : null,
                            };
                            return { ...prev, educations };
                          })
                        }
                      />
                    </Field>
                    <div className="flex justify-end sm:col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        className="text-danger"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            educations: prev.educations.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {form.skills.map((skill, index) => {
                  const skillFlagged = isFlagged(flagged, `skills.${index}.name`);
                  return (
                    <div
                      key={`skill-${index}`}
                      className={cn(
                        "flex items-center gap-1 rounded-md border border-border bg-muted/20 px-2 py-1",
                        skillFlagged && "border-warning/40 bg-warning-muted"
                      )}
                      title={skillFlagged ? "Requires review" : undefined}
                    >
                      <Input
                        className="h-7 w-28 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                        value={skill.name}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const skills = [...prev.skills];
                            skills[index] = { ...skills[index]!, name: e.target.value };
                            return { ...prev, skills };
                          })
                        }
                      />
                      <button
                        type="button"
                        disabled={pending}
                        className="text-muted-foreground hover:text-danger"
                        aria-label={`Remove skill ${skill.name}`}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            skills: prev.skills.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    setForm((prev) => ({ ...prev, skills: [...prev.skills, { name: "" }] }))
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add skill
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Projects</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      projects: [...prev.projects, { title: "" }],
                    }))
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              {form.projects.length === 0 && (
                <p className="text-xs text-muted-foreground">No projects extracted.</p>
              )}
              <div className="space-y-3">
                {form.projects.map((row, index) => (
                  <div
                    key={`proj-${index}`}
                    className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
                  >
                    <Field label="Title" path={`projects.${index}.title`} flagged={flagged}>
                      <Input
                        value={row.title}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const projects = [...prev.projects];
                            projects[index] = { ...projects[index]!, title: e.target.value };
                            return { ...prev, projects };
                          })
                        }
                      />
                    </Field>
                    <Field label="Link / URL" path={`projects.${index}.url`} flagged={flagged}>
                      <Input
                        value={row.url ?? ""}
                        disabled={pending}
                        placeholder="https://..."
                        onChange={(e) =>
                          setForm((prev) => {
                            const projects = [...prev.projects];
                            projects[index] = {
                              ...projects[index]!,
                              url: e.target.value || null,
                            };
                            return { ...prev, projects };
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Tech stack"
                      path={`projects.${index}.techstack`}
                      flagged={flagged}
                    >
                      <Input
                        value={row.techStack ?? ""}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const projects = [...prev.projects];
                            projects[index] = {
                              ...projects[index]!,
                              techStack: e.target.value || null,
                            };
                            return { ...prev, projects };
                          })
                        }
                      />
                    </Field>
                    <Field label="Duration" path={`projects.${index}.duration`} flagged={flagged}>
                      <Input
                        value={row.duration ?? ""}
                        disabled={pending}
                        placeholder="e.g. Jan 2023 – Jun 2023"
                        onChange={(e) =>
                          setForm((prev) => {
                            const projects = [...prev.projects];
                            projects[index] = {
                              ...projects[index]!,
                              duration: e.target.value || null,
                            };
                            return { ...prev, projects };
                          })
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field
                        label="Description"
                        path={`projects.${index}.summary`}
                        flagged={flagged}
                      >
                        <Textarea
                          value={row.summary ?? ""}
                          disabled={pending}
                          rows={2}
                          onChange={(e) =>
                            setForm((prev) => {
                              const projects = [...prev.projects];
                              projects[index] = {
                                ...projects[index]!,
                                summary: e.target.value || null,
                              };
                              return { ...prev, projects };
                            })
                          }
                        />
                      </Field>
                    </div>
                    <div className="flex justify-end sm:col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        className="text-danger"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            projects: prev.projects.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Certifications</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      certifications: [...prev.certifications, { name: "" }],
                    }))
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              {form.certifications.length === 0 && (
                <p className="text-xs text-muted-foreground">No certifications extracted.</p>
              )}
              <div className="space-y-3">
                {form.certifications.map((row, index) => (
                  <div
                    key={`cert-${index}`}
                    className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
                  >
                    <Field label="Name" path={`certifications.${index}.name`} flagged={flagged}>
                      <Input
                        value={row.name}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const certifications = [...prev.certifications];
                            certifications[index] = {
                              ...certifications[index]!,
                              name: e.target.value,
                            };
                            return { ...prev, certifications };
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Issuer"
                      path={`certifications.${index}.issuer`}
                      flagged={flagged}
                    >
                      <Input
                        value={row.issuer ?? ""}
                        disabled={pending}
                        onChange={(e) =>
                          setForm((prev) => {
                            const certifications = [...prev.certifications];
                            certifications[index] = {
                              ...certifications[index]!,
                              issuer: e.target.value || null,
                            };
                            return { ...prev, certifications };
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Issue date"
                      path={`certifications.${index}.issuedat`}
                      flagged={flagged}
                    >
                      <Input
                        value={row.issuedAt ?? ""}
                        disabled={pending}
                        placeholder="e.g. 2023-01"
                        onChange={(e) =>
                          setForm((prev) => {
                            const certifications = [...prev.certifications];
                            certifications[index] = {
                              ...certifications[index]!,
                              issuedAt: e.target.value || null,
                            };
                            return { ...prev, certifications };
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Credential URL"
                      path={`certifications.${index}.credentialurl`}
                      flagged={flagged}
                    >
                      <Input
                        value={row.credentialUrl ?? ""}
                        disabled={pending}
                        placeholder="https://..."
                        onChange={(e) =>
                          setForm((prev) => {
                            const certifications = [...prev.certifications];
                            certifications[index] = {
                              ...certifications[index]!,
                              credentialUrl: e.target.value || null,
                            };
                            return { ...prev, certifications };
                          })
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        className="text-danger"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            certifications: prev.certifications.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="max-h-[70vh] lg:sticky lg:top-4">
            <AiInsightsPane draft={draft} />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
            Back to upload
          </Button>
          <Button
            type="button"
            className="font-semibold shadow-subtle"
            disabled={pending || !form.candidate.fullName?.trim()}
            onClick={handleCreate}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating candidate...
              </>
            ) : (
              "Create Candidate"
            )}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
