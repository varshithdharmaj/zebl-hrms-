import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import type { ResumeImportMappedDraft } from "@/lib/recruitment/resume-import/types";
import {
  computeCandidateFieldStatus,
  listMissingFieldLabels,
} from "./field-status";
import type { CandidateEnrichmentContext } from "./types";

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/**
 * Build LLM context from application data only (no raw resume dump by default).
 * Prefer profile + parsed mapped draft. Optional bounded excerpt when summary empty.
 */
export function buildCandidateEnrichmentContext(input: {
  candidate: CandidateDetail;
  mapped?: ResumeImportMappedDraft | null;
  resumeExcerpt?: string | null;
}): CandidateEnrichmentContext {
  const { candidate, mapped } = input;
  const fieldStatus = computeCandidateFieldStatus(candidate);
  const missingFields = listMissingFieldLabels(fieldStatus);

  const skillsFromProfile = (candidate.skills ?? [])
    .map((s) => s.name || s.skillName || "")
    .filter(Boolean);
  const skillsFromMapped = (mapped?.skills ?? []).map((s) => s.name).filter(Boolean);
  const skills = Array.from(new Set([...skillsFromProfile, ...skillsFromMapped]));

  const experienceFromProfile = (candidate.experiences ?? []).map((e) => ({
    title: e.title || e.designation || "Role",
    company: e.company || e.companyName || "Company",
    isCurrent: Boolean(e.isCurrent ?? e.currentlyWorking),
    description: truncate(e.description, 280),
  }));
  const experienceFromMapped = (mapped?.experiences ?? []).map((e) => ({
    title: e.title,
    company: e.company,
    isCurrent: Boolean(e.isCurrent),
    description: truncate(e.description, 280),
  }));
  const experience =
    experienceFromProfile.length > 0 ? experienceFromProfile : experienceFromMapped;

  const educationFromProfile = (candidate.educations ?? []).map((e) => ({
    institution: e.institution,
    degree: e.degree,
    endYear: e.endYear,
  }));
  const educationFromMapped = (mapped?.educations ?? []).map((e) => ({
    institution: e.institution,
    degree: e.degree ?? null,
    endYear: e.endYear ?? null,
  }));
  const education =
    educationFromProfile.length > 0 ? educationFromProfile : educationFromMapped;

  const projectsFromProfile = (candidate.projects ?? []).map((p) => ({
    title: p.title,
    summary: truncate(p.summary ?? p.description, 200),
    techStack: p.techStack ?? p.technologies ?? null,
  }));
  const projectsFromMapped = (mapped?.projects ?? []).map((p) => ({
    title: p.title,
    summary: truncate(p.summary, 200),
    techStack: p.techStack ?? null,
  }));
  const projects =
    projectsFromProfile.length > 0 ? projectsFromProfile : projectsFromMapped;

  const certsFromProfile = (candidate.certifications ?? []).map((c) => ({
    name: c.name,
    issuer: c.issuer,
  }));
  const certsFromMapped = (mapped?.certifications ?? []).map((c) => ({
    name: c.name,
    issuer: c.issuer ?? null,
  }));
  const certifications =
    certsFromProfile.length > 0 ? certsFromProfile : certsFromMapped;

  const summaryEmpty = fieldStatus.summary === "empty";
  const mappedSummary = mapped?.professional.professionalSummary ?? null;

  return {
    candidate: {
      currentTitle: candidate.currentTitle ?? mapped?.professional.currentTitle ?? null,
      currentCompany:
        candidate.currentCompany ?? mapped?.professional.currentCompany ?? null,
      location: candidate.location ?? mapped?.personal.location ?? null,
      experienceYears:
        candidate.totalExperienceYears ??
        mapped?.professional.totalExperienceYears ??
        null,
      summary: candidate.professionalSummary ?? mappedSummary,
      headline: candidate.headline ?? mapped?.professional.headline ?? null,
    },
    skills,
    experience,
    education,
    projects,
    certifications,
    fieldStatus,
    missingFields,
    resumeExcerpt:
      summaryEmpty && !mappedSummary && input.resumeExcerpt
        ? truncate(input.resumeExcerpt, 1500)
        : null,
  };
}

/** Strip emails/phones from any accidental excerpt before send. */
export function sanitizeResumeExcerpt(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(
      /(?:\+\d{1,3}[\s.-]*)?(?:\(?\d{2,4}\)?[\s.-]*)?\d{3,5}[\s.-]*\d{3,5}/g,
      "[phone]"
    )
    .trim()
    .slice(0, 1500);
}
