"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/ui/section-card";
import { createCandidateFromResumeReviewAction } from "@/actions/recruitment-new-candidate-resume";
import type { NewCandidateResumeReviewDraft } from "@/lib/recruitment/services/create-candidate-from-resume-service";
import {
  mapParsedDraftToReviewDefaults,
  stripDeniedFieldsFromReviewPayload,
} from "@/lib/recruitment/resume-import/map-new-candidate-review";
import type { CreateCandidateFromResumeReviewInput } from "@/lib/validation/schemas/recruitment/new-candidate-resume";

type Props = {
  draft: NewCandidateResumeReviewDraft;
  onBack: () => void;
  onContinueManual: () => void;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function NewCandidateResumeReview({
  draft,
  onBack,
  onContinueManual,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duplicateCandidateId, setDuplicateCandidateId] = useState<string | null>(null);

  const initial = useMemo(
    () => mapParsedDraftToReviewDefaults(draft.intakeId, draft.mapped),
    [draft.intakeId, draft.mapped]
  );

  const [form, setForm] = useState<CreateCandidateFromResumeReviewInput>(initial);

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
      const notice =
        result.resumeAttached === false ? "?notice=resume-attach-failed" : "";
      router.push(
        `/admin/recruitment/candidates/${result.candidateId}${notice}`
      );
    });
  }

  if (!draft.parseOk) {
    return (
      <SectionCard
        title="Could not extract resume text"
        description="No readable text was found. Scanned image PDFs are not supported."
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
      description="These fields were extracted from the resume. Please review before creating the candidate."
    >
      <div className="space-y-6">
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

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Basic information</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name *">
              <Input
                value={form.candidate.fullName ?? ""}
                onChange={(e) => updateCandidate({ fullName: e.target.value })}
                disabled={pending}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.candidate.email ?? ""}
                onChange={(e) => updateCandidate({ email: e.target.value || null })}
                disabled={pending}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.candidate.phone ?? ""}
                onChange={(e) => updateCandidate({ phone: e.target.value || null })}
                disabled={pending}
                placeholder="+91..."
              />
            </Field>
            <Field label="Location">
              <Input
                value={form.candidate.location ?? ""}
                onChange={(e) =>
                  updateCandidate({ location: e.target.value || null })
                }
                disabled={pending}
              />
            </Field>
            <Field label="LinkedIn">
              <Input
                value={form.candidate.linkedinUrl ?? ""}
                onChange={(e) =>
                  updateCandidate({ linkedinUrl: e.target.value || null })
                }
                disabled={pending}
              />
            </Field>
            <Field label="GitHub">
              <Input
                value={form.candidate.githubUrl ?? ""}
                onChange={(e) =>
                  updateCandidate({ githubUrl: e.target.value || null })
                }
                disabled={pending}
              />
            </Field>
            <Field label="Portfolio">
              <Input
                value={form.candidate.portfolioUrl ?? ""}
                onChange={(e) =>
                  updateCandidate({ portfolioUrl: e.target.value || null })
                }
                disabled={pending}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Professional</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Headline">
              <Input
                value={form.candidate.headline ?? ""}
                onChange={(e) =>
                  updateCandidate({ headline: e.target.value || null })
                }
                disabled={pending}
              />
            </Field>
            <Field label="Total experience (years)">
              <Input
                value={form.candidate.totalExperienceYears ?? ""}
                onChange={(e) =>
                  updateCandidate({
                    totalExperienceYears: e.target.value || null,
                  })
                }
                disabled={pending}
              />
            </Field>
            <Field label="Current company">
              <Input
                value={form.candidate.currentCompany ?? ""}
                onChange={(e) =>
                  updateCandidate({ currentCompany: e.target.value || null })
                }
                disabled={pending}
              />
            </Field>
            <Field label="Current title">
              <Input
                value={form.candidate.currentTitle ?? ""}
                onChange={(e) =>
                  updateCandidate({ currentTitle: e.target.value || null })
                }
                disabled={pending}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Summary">
                <Textarea
                  value={form.candidate.professionalSummary ?? ""}
                  onChange={(e) =>
                    updateCandidate({
                      professionalSummary: e.target.value || null,
                    })
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
                <Field label="Company">
                  <Input
                    value={row.company}
                    disabled={pending}
                    onChange={(e) =>
                      setForm((prev) => {
                        const experiences = [...prev.experiences];
                        experiences[index] = {
                          ...experiences[index]!,
                          company: e.target.value,
                        };
                        return { ...prev, experiences };
                      })
                    }
                  />
                </Field>
                <Field label="Title">
                  <Input
                    value={row.title}
                    disabled={pending}
                    onChange={(e) =>
                      setForm((prev) => {
                        const experiences = [...prev.experiences];
                        experiences[index] = {
                          ...experiences[index]!,
                          title: e.target.value,
                        };
                        return { ...prev, experiences };
                      })
                    }
                  />
                </Field>
                <Field label="Start">
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
                <Field label="End">
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
                  <Field label="Description">
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
                <Field label="Institution">
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
                <Field label="Degree">
                  <Input
                    value={row.degree ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      setForm((prev) => {
                        const educations = [...prev.educations];
                        educations[index] = {
                          ...educations[index]!,
                          degree: e.target.value || null,
                        };
                        return { ...prev, educations };
                      })
                    }
                  />
                </Field>
                <Field label="Field">
                  <Input
                    value={row.field ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      setForm((prev) => {
                        const educations = [...prev.educations];
                        educations[index] = {
                          ...educations[index]!,
                          field: e.target.value || null,
                        };
                        return { ...prev, educations };
                      })
                    }
                  />
                </Field>
                <Field label="Graduation year">
                  <Input
                    type="number"
                    value={row.endYear ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      setForm((prev) => {
                        const educations = [...prev.educations];
                        const n = e.target.value
                          ? Number.parseInt(e.target.value, 10)
                          : null;
                        educations[index] = {
                          ...educations[index]!,
                          endYear: Number.isFinite(n) ? n : null,
                        };
                        return { ...prev, educations };
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
            {form.skills.map((skill, index) => (
              <div
                key={`skill-${index}`}
                className="flex items-center gap-1 rounded-md border border-border bg-muted/20 px-2 py-1"
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
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  skills: [...prev.skills, { name: "" }],
                }))
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add skill
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Projects</h3>
          {form.projects.length === 0 && (
            <p className="text-xs text-muted-foreground">No projects extracted.</p>
          )}
          <div className="space-y-3">
            {form.projects.map((row, index) => (
              <div
                key={`proj-${index}`}
                className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
              >
                <Field label="Title">
                  <Input
                    value={row.title}
                    disabled={pending}
                    onChange={(e) =>
                      setForm((prev) => {
                        const projects = [...prev.projects];
                        projects[index] = {
                          ...projects[index]!,
                          title: e.target.value,
                        };
                        return { ...prev, projects };
                      })
                    }
                  />
                </Field>
                <Field label="Tech stack">
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
                <Field label="URL">
                  <Input
                    value={row.url ?? ""}
                    disabled={pending}
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
                <Field label="Duration">
                  <Input
                    value={row.duration ?? ""}
                    disabled={pending}
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
                  <Field label="Summary">
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
          <h3 className="text-sm font-semibold text-foreground">Certifications</h3>
          {form.certifications.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No certifications extracted.
            </p>
          )}
          <div className="space-y-3">
            {form.certifications.map((row, index) => (
              <div
                key={`cert-${index}`}
                className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
              >
                <Field label="Name">
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
                <Field label="Issuer">
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
                <Field label="Issue date">
                  <Input
                    value={row.issuedAt ?? ""}
                    disabled={pending}
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
                <Field label="Credential URL">
                  <Input
                    value={row.credentialUrl ?? ""}
                    disabled={pending}
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
                <Field label="Credential ID">
                  <Input
                    value={row.credentialId ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      setForm((prev) => {
                        const certifications = [...prev.certifications];
                        certifications[index] = {
                          ...certifications[index]!,
                          credentialId: e.target.value || null,
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
                        certifications: prev.certifications.filter(
                          (_, i) => i !== index
                        ),
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
