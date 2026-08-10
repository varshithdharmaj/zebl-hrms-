import "server-only";

import { createHash } from "node:crypto";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import type { ResumeImportMappedDraft } from "@/lib/recruitment/resume-import/types";
import { buildCandidateEnrichmentContext } from "./build-context";
import { CANDIDATE_ENRICHMENT_PROMPT_VERSION } from "./types";

function normText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

/**
 * Deterministic fingerprint of enrichment-relevant candidate + draft context.
 * Excludes CTC/notice/availability/email/phone/raw resume/AI prose.
 */
export function computeEnrichmentInputFingerprint(input: {
  candidate: CandidateDetail;
  mapped?: ResumeImportMappedDraft | null;
  documentId: string | null;
  sourceDraftId: string | null;
}): string {
  const ctx = buildCandidateEnrichmentContext({
    candidate: input.candidate,
    mapped: input.mapped ?? null,
  });

  const linkedinUrl =
    normText(input.candidate.linkedinUrl) ??
    normText(input.mapped?.professional.linkedinUrl);
  const githubUrl =
    normText(input.candidate.githubUrl) ??
    normText(input.mapped?.professional.githubUrl);
  const portfolioUrl =
    normText(input.candidate.personal?.portfolioUrl) ??
    normText(input.mapped?.professional.portfolioUrl);

  const payload = {
    promptVersion: CANDIDATE_ENRICHMENT_PROMPT_VERSION,
    documentId: input.documentId,
    sourceDraftId: input.sourceDraftId,
    candidate: {
      currentTitle: normText(ctx.candidate.currentTitle),
      currentCompany: normText(ctx.candidate.currentCompany),
      location: normText(ctx.candidate.location),
      experienceYears: normText(ctx.candidate.experienceYears),
      summary: normText(ctx.candidate.summary),
      headline: normText(ctx.candidate.headline),
      linkedinUrl,
      githubUrl,
      portfolioUrl,
    },
    // Skills are a set in context — sort for stability.
    skills: [...ctx.skills].map((s) => s.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    // Preserve experience/education order as used in enrichment context.
    experience: ctx.experience.map((row) => ({
      title: normText(row.title),
      company: normText(row.company),
      isCurrent: Boolean(row.isCurrent),
      description: normText(row.description),
    })),
    education: ctx.education.map((row) => ({
      institution: normText(row.institution),
      degree: normText(row.degree),
      endYear: row.endYear ?? null,
    })),
    projects: [...ctx.projects]
      .map((row) => ({
        title: normText(row.title),
        summary: normText(row.summary),
        techStack: normText(row.techStack),
      }))
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    certifications: [...ctx.certifications]
      .map((row) => ({
        name: normText(row.name),
        issuer: normText(row.issuer),
      }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
  };

  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function enrichmentFingerprintsMatch(
  stored: string | null | undefined,
  current: string
): boolean {
  if (!stored || !stored.trim()) return false;
  return stored === current;
}
