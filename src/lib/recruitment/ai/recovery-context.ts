import "server-only";

import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import type { RecoveryFieldKey, ResumeFieldRecoveryContext } from "./recovery-types";

const MAX_RESUME_CHARS = 12_000;

/** Redact contact PII without the enrichment excerpt length cap. */
export function sanitizeResumeTextForRecovery(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(
      /(?:\+\d{1,3}[\s.-]*)?(?:\(?\d{2,4}\)?[\s.-]*)?\d{3,5}[\s.-]*\d{3,5}/g,
      "[phone]"
    )
    .trim();
}

/**
 * Prefer keeping section-like blocks when truncating (split on blank lines).
 */
export function boundResumeTextForRecovery(raw: string): string {
  const cleaned = sanitizeResumeTextForRecovery(raw).replace(/\r\n/g, "\n");
  if (cleaned.length <= MAX_RESUME_CHARS) return cleaned;

  const blocks = cleaned.split(/\n{2,}/);
  let out = "";
  for (const block of blocks) {
    const next = out ? `${out}\n\n${block}` : block;
    if (next.length > MAX_RESUME_CHARS) break;
    out = next;
  }
  if (!out) return cleaned.slice(0, MAX_RESUME_CHARS);
  return `${out}\n\n[truncated]`;
}

export function buildResumeFieldRecoveryContext(input: {
  candidate: CandidateDetail;
  resumeText: string;
  eligibleFields: RecoveryFieldKey[];
}): ResumeFieldRecoveryContext {
  const c = input.candidate;
  return {
    eligibleFields: input.eligibleFields,
    resumeText: boundResumeTextForRecovery(input.resumeText),
    parsedCandidate: {
      headline: c.headline,
      summary: c.professionalSummary,
      location: c.location,
      githubUrl: c.githubUrl,
      linkedinUrl: c.linkedinUrl ?? c.personal?.linkedinUrl ?? null,
      portfolioUrl: c.personal?.portfolioUrl ?? null,
      experiences: (c.experiences ?? []).slice(0, 12).map((e) => ({
        title: e.title || e.designation || "Role",
        company: e.company || e.companyName || "Company",
        location: e.location ?? null,
      })),
      education: (c.educations ?? []).slice(0, 8).map((e) => ({
        institution: e.institution,
        degree: e.degree,
        field: e.field ?? e.fieldOfStudy,
        endYear: e.endYear,
      })),
      skills: (c.skills ?? [])
        .slice(0, 40)
        .map((s) => s.name || s.skillName || "")
        .filter(Boolean),
      projects: (c.projects ?? []).slice(0, 10).map((p) => ({
        title: p.title,
        summary: p.summary ?? p.description,
        techStack: p.techStack ?? p.technologies,
      })),
      certifications: (c.certifications ?? []).slice(0, 10).map((row) => ({
        name: row.name,
        issuer: row.issuer,
      })),
    },
  };
}
