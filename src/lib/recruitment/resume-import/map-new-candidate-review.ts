import type { ResumeImportMappedDraft } from "@/lib/recruitment/resume-import/types";
import { RESUME_IMPORT_DENIED_SCALAR_KEYS } from "@/lib/recruitment/resume-import/types";
import type { CreateCandidateFromResumeReviewInput } from "@/lib/validation/schemas/recruitment/new-candidate-resume";

const DENIED = new Set<string>(RESUME_IMPORT_DENIED_SCALAR_KEYS);

/**
 * Map Parser V2 mapped draft → recruiter review defaults (denied scalars stripped).
 */
export function mapParsedDraftToReviewDefaults(
  intakeId: string,
  mapped: ResumeImportMappedDraft
): CreateCandidateFromResumeReviewInput {
  const candidate: Record<string, unknown> = {
    fullName: mapped.personal.fullName?.trim() ?? "",
    firstName: mapped.personal.firstName ?? null,
    lastName: mapped.personal.lastName ?? null,
    email: mapped.personal.email ?? null,
    phone: mapped.personal.phone ?? null,
    location: mapped.personal.location ?? null,
    headline: mapped.professional.headline ?? null,
    professionalSummary: mapped.professional.professionalSummary ?? null,
    currentCompany: mapped.professional.currentCompany ?? null,
    currentTitle: mapped.professional.currentTitle ?? null,
    totalExperienceYears: mapped.professional.totalExperienceYears ?? null,
    linkedinUrl: mapped.professional.linkedinUrl ?? null,
    githubUrl: mapped.professional.githubUrl ?? null,
    portfolioUrl: mapped.professional.portfolioUrl ?? null,
    preferredWorkMode: mapped.professional.preferredWorkMode ?? null,
    willingToRelocate: mapped.professional.willingToRelocate ?? null,
  };

  for (const key of DENIED) {
    delete candidate[key];
  }

  return {
    intakeId,
    candidate: candidate as CreateCandidateFromResumeReviewInput["candidate"],
    experiences: (mapped.experiences ?? []).filter(
      (e) => e.company?.trim() && e.title?.trim()
    ),
    educations: (mapped.educations ?? []).filter((e) => e.institution?.trim()),
    skills: (mapped.skills ?? []).filter((s) => s.name?.trim()),
    projects: (mapped.projects ?? []).filter((p) => p.title?.trim()),
    certifications: (mapped.certifications ?? []).filter((c) => c.name?.trim()),
  };
}

/** Ensure denied keys never appear on a review payload before create. */
export function stripDeniedFieldsFromReviewPayload(
  payload: CreateCandidateFromResumeReviewInput
): CreateCandidateFromResumeReviewInput {
  const candidate = { ...payload.candidate } as Record<string, unknown>;
  for (const key of DENIED) {
    delete candidate[key];
  }
  return {
    ...payload,
    candidate: candidate as CreateCandidateFromResumeReviewInput["candidate"],
  };
}
