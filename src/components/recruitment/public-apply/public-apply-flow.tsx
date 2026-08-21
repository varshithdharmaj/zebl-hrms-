"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Badge } from "@/components/ui/badge";

type Step = "basic" | "resume" | "parsing" | "review" | "confirm" | "success";

type ReviewPersonal = {
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
};

type ReviewProfessional = {
  headline: string | null;
  professionalSummary: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  totalExperienceYears: string | null;
  preferredWorkMode: string | null;
  willingToRelocate: boolean | null;
};

type ExperienceRow = { company: string; title: string; startDate?: string | null; endDate?: string | null; description?: string | null };
type EducationRow = { institution: string; degree?: string | null; field?: string | null };
type SkillRow = { name: string; proficiency?: string | null };
type ProjectRow = { title: string; summary?: string | null };
type CertificationRow = { name: string; issuer?: string | null };

type ReviewPayload = {
  personal: ReviewPersonal;
  professional: ReviewProfessional;
  experiences: ExperienceRow[];
  educations: EducationRow[];
  skills: SkillRow[];
  projects: ProjectRow[];
  certifications: CertificationRow[];
};

const STEP_LABEL: Record<Step, string> = {
  basic: "Step 1 of 4 — Your details",
  resume: "Step 2 of 4 — Resume",
  parsing: "Step 2 of 4 — Resume",
  review: "Step 3 of 4 — Review",
  confirm: "Step 4 of 4 — Submit",
  success: "Done",
};

async function callApi<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { ...(options.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && (body as { error?: { message?: string } }).error?.message) ||
      "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return body as T;
}

export function PublicApplyFlow({ jobPublicSlug, jobTitle }: { jobPublicSlug: string; jobTitle: string }) {
  const [step, setStep] = useState<Step>("basic");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);

  const [basic, setBasic] = useState({ fullName: "", email: "", phone: "" });
  const [file, setFile] = useState<File | null>(null);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [consent, setConsent] = useState(false);

  const storageKey = `public-apply:${jobPublicSlug}`;

  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(storageKey) : null;
    if (saved) {
      try {
        setToken(JSON.parse(saved).token ?? null);
      } catch {
        // ignore corrupt storage
      }
    }
  }, [storageKey]);

  async function ensureStarted(): Promise<string> {
    if (token) return token;
    const result = await callApi<{ token: string; expiresAt: string }>("/api/public/applications/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobPublicSlug }),
    });
    setToken(result.token);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(storageKey, JSON.stringify({ token: result.token }));
    }
    return result.token;
  }

  async function handleBasicSubmit() {
    setError(null);
    setBusy(true);
    try {
      const t = await ensureStarted();
      await callApi(`/api/public/applications/${encodeURIComponent(t)}/basic-info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basic),
      });
      setStep("resume");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResumeUpload() {
    if (!file || !token) return;
    setError(null);
    setBusy(true);
    setParseNote(null);
    try {
      const form = new FormData();
      form.append("resume", file);
      await callApi(`/api/public/applications/${encodeURIComponent(token)}/resume`, {
        method: "POST",
        body: form,
      });
      setStep("parsing");

      const outcome = await callApi<{ status: string; reason?: string }>(
        `/api/public/applications/${encodeURIComponent(token)}/parse`,
        { method: "POST" }
      );

      if (outcome.status === "parse_failed") {
        setParseNote(parseFailureCopy(outcome.reason));
      }

      const reviewData = await callApi<{ review: ReviewPayload }>(
        `/api/public/applications/${encodeURIComponent(token)}/review`,
        { method: "GET" }
      );
      setReview(reviewData.review);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("resume");
    } finally {
      setBusy(false);
    }
  }

  async function handleReviewContinue() {
    if (!token || !review) return;
    setError(null);
    setBusy(true);
    try {
      await callApi(`/api/public/applications/${encodeURIComponent(token)}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(review),
      });
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!token || !consent) return;
    setError(null);
    setBusy(true);
    try {
      const result = await callApi<{ referenceCode: string }>(
        `/api/public/applications/${encodeURIComponent(token)}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent: true }),
        }
      );
      setReferenceCode(result.referenceCode);
      setStep("success");
      if (typeof window !== "undefined") sessionStorage.removeItem(storageKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "success") {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-lg font-semibold text-foreground">Application received</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Thanks for applying to {jobTitle}. Our team will review your application and be in touch.
          </p>
          {referenceCode ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Reference code: <span className="font-mono font-medium text-foreground">{referenceCode}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Badge className="w-fit">{STEP_LABEL[step]}</Badge>
        <CardTitle className="text-lg">Apply for {jobTitle}</CardTitle>
        <CardDescription>No account needed — this takes about 3 minutes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-0">
        {error ? <ErrorAlert message={error} /> : null}

        {step === "basic" && (
          <div className="flex flex-col gap-4">
            <Field label="Full name">
              <Input
                value={basic.fullName}
                onChange={(e) => setBasic((b) => ({ ...b, fullName: e.target.value }))}
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={basic.email}
                onChange={(e) => setBasic((b) => ({ ...b, email: e.target.value }))}
                placeholder="jane@example.com"
              />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                value={basic.phone}
                onChange={(e) => setBasic((b) => ({ ...b, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </Field>
            <Button
              onClick={handleBasicSubmit}
              loading={busy}
              disabled={!basic.fullName.trim() || !basic.email.trim() || !basic.phone.trim()}
            >
              Continue
            </Button>
          </div>
        )}

        {step === "resume" && (
          <div className="flex flex-col gap-4">
            <Field label="Resume (PDF or Word, up to 10 MB)">
              <Input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            <Button onClick={handleResumeUpload} loading={busy} disabled={!file}>
              Upload & continue
            </Button>
          </div>
        )}

        {step === "parsing" && (
          <p className="py-8 text-center text-sm text-muted-foreground" aria-live="polite">
            Reading your resume…
          </p>
        )}

        {step === "review" && review && (
          <ReviewForm review={review} onChange={setReview} parseNote={parseNote} />
        )}
        {step === "review" && (
          <Button onClick={handleReviewContinue} loading={busy} disabled={!review?.personal.fullName.trim()}>
            Continue
          </Button>
        )}

        {step === "confirm" && review && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Please review your information before submitting. Once submitted, you cannot edit this
              application.
            </p>
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium text-foreground">{review.personal.fullName}</p>
              <p className="text-muted-foreground">{review.personal.email}</p>
              <p className="text-muted-foreground">{review.personal.phone}</p>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="consent" checked={consent} onCheckedChange={setConsent} className="mt-0.5" />
              <Label htmlFor="consent" className="text-sm font-normal text-muted-foreground">
                I consent to ZEBL storing and processing the information above to evaluate my application.
              </Label>
            </div>
            <Button onClick={handleSubmit} loading={busy} disabled={!consent}>
              Submit application
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function parseFailureCopy(reason?: string): string {
  switch (reason) {
    case "EMPTY_DOCUMENT":
      return "We couldn't find selectable text in this file (it may be a scanned image). Please fill in your details below.";
    case "UNSUPPORTED_TYPE":
      return "We couldn't read this file. Please fill in your details below.";
    case "CORRUPTED_FILE":
    case "EXTRACTION_FAILED":
      return "This file looks damaged. Please fill in your details below.";
    default:
      return "We couldn't automatically read your resume. Please fill in your details below.";
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ReviewForm({
  review,
  onChange,
  parseNote,
}: {
  review: ReviewPayload;
  onChange: (r: ReviewPayload) => void;
  parseNote: string | null;
}) {
  function setPersonal(patch: Partial<ReviewPersonal>) {
    onChange({ ...review, personal: { ...review.personal, ...patch } });
  }
  function setProfessional(patch: Partial<ReviewProfessional>) {
    onChange({ ...review, professional: { ...review.professional, ...patch } });
  }

  return (
    <div className="flex flex-col gap-6">
      {parseNote ? <ErrorAlert message={parseNote} /> : null}

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">Personal</h3>
        <Field label="Full name">
          <Input value={review.personal.fullName} onChange={(e) => setPersonal({ fullName: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input value={review.personal.email ?? ""} onChange={(e) => setPersonal({ email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={review.personal.phone ?? ""} onChange={(e) => setPersonal({ phone: e.target.value })} />
        </Field>
        <Field label="Location">
          <Input
            value={review.personal.location ?? ""}
            onChange={(e) => setPersonal({ location: e.target.value })}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">Professional</h3>
        <Field label="Current title">
          <Input
            value={review.professional.currentTitle ?? ""}
            onChange={(e) => setProfessional({ currentTitle: e.target.value })}
          />
        </Field>
        <Field label="Current company">
          <Input
            value={review.professional.currentCompany ?? ""}
            onChange={(e) => setProfessional({ currentCompany: e.target.value })}
          />
        </Field>
        <Field label="Summary">
          <Input
            value={review.professional.professionalSummary ?? ""}
            onChange={(e) => setProfessional({ professionalSummary: e.target.value })}
          />
        </Field>
      </section>

      <ListEditor
        title="Experience"
        rows={review.experiences}
        onChange={(rows) => onChange({ ...review, experiences: rows })}
        empty={{ company: "", title: "" }}
        renderRow={(row, set) => (
          <>
            <Input placeholder="Company" value={row.company} onChange={(e) => set({ ...row, company: e.target.value })} />
            <Input placeholder="Title" value={row.title} onChange={(e) => set({ ...row, title: e.target.value })} />
          </>
        )}
      />

      <ListEditor
        title="Education"
        rows={review.educations}
        onChange={(rows) => onChange({ ...review, educations: rows })}
        empty={{ institution: "" }}
        renderRow={(row, set) => (
          <>
            <Input
              placeholder="Institution"
              value={row.institution}
              onChange={(e) => set({ ...row, institution: e.target.value })}
            />
            <Input
              placeholder="Degree"
              value={row.degree ?? ""}
              onChange={(e) => set({ ...row, degree: e.target.value })}
            />
          </>
        )}
      />

      <ListEditor
        title="Skills"
        rows={review.skills}
        onChange={(rows) => onChange({ ...review, skills: rows })}
        empty={{ name: "" }}
        renderRow={(row, set) => (
          <Input placeholder="Skill" value={row.name} onChange={(e) => set({ ...row, name: e.target.value })} />
        )}
      />
    </div>
  );
}

function ListEditor<T>({
  title,
  rows,
  onChange,
  empty,
  renderRow,
}: {
  title: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  empty: T;
  renderRow: (row: T, set: (row: T) => void) => React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">None added.</p> : null}
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            {renderRow(row, (next) => {
              const copy = [...rows];
              copy[i] = next;
              onChange(copy);
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...rows, empty])}>
        Add {title.toLowerCase()}
      </Button>
    </section>
  );
}
