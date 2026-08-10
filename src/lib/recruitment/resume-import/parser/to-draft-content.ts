import type {
  ResumeImportDraftContent,
  ResumeImportMappedDraft,
} from "@/lib/recruitment/resume-import/types";
import type { ParsedResumeDraft } from "./types";
import { RESUME_PARSER_VERSION } from "./types";

function splitName(fullName: string | null): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Map normalized parser output → ResumeImportMappedDraft for the merge engine.
 */
export function mappedDraftFromParsed(draft: ParsedResumeDraft): ResumeImportMappedDraft {
  const { firstName, lastName } = splitName(draft.personal.fullName);

  return {
    personal: {
      fullName: draft.personal.fullName,
      firstName,
      lastName,
      email: draft.personal.email,
      phone: draft.personal.phone,
      location: draft.personal.location,
    },
    professional: {
      headline: draft.professional.headline,
      professionalSummary: draft.professional.summary,
      currentCompany: draft.professional.currentCompany,
      currentTitle: draft.professional.currentTitle,
      githubUrl: draft.personal.githubUrl,
      linkedinUrl: draft.personal.linkedinUrl,
      portfolioUrl: draft.personal.portfolioUrl,
      totalExperienceYears: draft.professional.totalExperienceYears,
      preferredWorkMode: null,
      willingToRelocate: null,
    },
    experiences: draft.experiences.map((e, index) => ({
      company: e.company,
      title: e.title,
      location: e.location ?? null,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      description: e.description,
      sortOrder: index,
    })),
    educations: draft.educations.map((e, index) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      startYear: null,
      endYear: e.graduationYear,
      grade: null,
      sortOrder: index,
    })),
    skills: draft.skills.map((name) => ({
      name,
      proficiency: null,
      yearsOfExperience: null,
    })),
    projects: (draft.projects ?? []).map((p, index) => ({
      title: p.title,
      summary: p.summary,
      techStack: p.techStack,
      url: p.url,
      role: null,
      duration: p.duration,
      sortOrder: index,
    })),
    certifications: (draft.certifications ?? []).map((c) => ({
      name: c.name,
      issuer: c.issuer,
      issuedAt: c.issuedAt,
      expiresAt: null,
      credentialId: c.credentialId,
      credentialUrl: c.credentialUrl,
    })),
  };
}

export function draftContentFromParsed(input: {
  draft: ParsedResumeDraft;
  documentId: string | null;
  warnings: string[];
  rawTextLength: number;
  errorNote?: string;
  semanticVerification?: ResumeImportDraftContent["metadata"]["semanticVerification"];
}): ResumeImportDraftContent {
  const mapped = mappedDraftFromParsed(input.draft);
  const fieldConfidence: Record<string, number> = {};

  const bump = (key: string, value: unknown, base = 0.75) => {
    if (value !== null && value !== undefined && value !== "") {
      fieldConfidence[key] = base;
    }
  };

  bump("personal.fullName", mapped.personal.fullName, 0.7);
  bump("personal.email", mapped.personal.email, 0.9);
  bump("personal.phone", mapped.personal.phone, 0.85);
  bump("personal.location", mapped.personal.location, 0.6);
  bump("professional.linkedinUrl", mapped.professional.linkedinUrl, 0.9);
  bump("professional.githubUrl", mapped.professional.githubUrl, 0.9);
  bump("professional.portfolioUrl", mapped.professional.portfolioUrl, 0.7);
  bump("professional.professionalSummary", mapped.professional.professionalSummary, 0.55);
  bump("professional.headline", mapped.professional.headline, 0.7);
  bump("professional.currentCompany", mapped.professional.currentCompany, 0.65);
  bump("professional.currentTitle", mapped.professional.currentTitle, 0.65);
  bump("professional.totalExperienceYears", mapped.professional.totalExperienceYears, 0.5);

  if (mapped.experiences.length) fieldConfidence["section.experiences"] = 0.65;
  if (mapped.educations.length) fieldConfidence["section.educations"] = 0.65;
  if (mapped.skills.length) fieldConfidence["section.skills"] = 0.7;
  if (mapped.projects.length) fieldConfidence["section.projects"] = 0.6;
  if (mapped.certifications.length) fieldConfidence["section.certifications"] = 0.6;

  const noteParts = [...input.warnings];
  if (input.errorNote) noteParts.unshift(input.errorNote);

  return {
    version: 1,
    source: "parser",
    documentId: input.documentId,
    raw: {
      textLength: input.rawTextLength,
    },
    mapped,
    fieldConfidence,
    metadata: {
      parserVersion: RESUME_PARSER_VERSION,
      note: noteParts.length ? noteParts.join(" ") : undefined,
      ...(input.semanticVerification
        ? { semanticVerification: input.semanticVerification }
        : {}),
    },
  };
}
