import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import {
  displayValue,
  normalizeComparable,
} from "@/lib/recruitment/resume-import/draft-content";
import {
  JOB_TITLE_SIGNAL_RE,
  looksLikeJobTitle,
  looksLikeName,
} from "@/lib/recruitment/resume-import/parser/patterns";
import type {
  ResumeImportCertificationMapped,
  ResumeImportEducationMapped,
  ResumeImportExperienceMapped,
  ResumeImportMappedDraft,
  ResumeImportProjectMapped,
  ResumeImportSkillMapped,
} from "@/lib/recruitment/resume-import/types";

export type ResumeMergeConflict = {
  key: string;
  label: string;
  currentValue: string;
  parsedValue: string;
};

export type ResumeMergeResult = {
  /** Empty profile fields that can be filled without confirmation. */
  autoFill: Record<string, string | number | boolean | null>;
  /** Profile vs resume mismatches — HR must choose. */
  conflicts: ResumeMergeConflict[];
  experiencesToAppend: ResumeImportExperienceMapped[];
  educationsToAppend: ResumeImportEducationMapped[];
  skillsToAppend: ResumeImportSkillMapped[];
  projectsToAppend: ResumeImportProjectMapped[];
  certificationsToAppend: ResumeImportCertificationMapped[];
};

type ScalarDef = {
  key: string;
  label: string;
  current: unknown;
  imported: unknown;
};

/** P0 identity/role fields — weak parser values must not silently auto-fill. */
const P0_AUTOFILL_KEYS = new Set([
  "fullName",
  "headline",
  "currentTitle",
  "currentCompany",
]);

const WEAK_PROJECT_COMPANY_RE =
  /\b((?:employee|library|inventory|hospital|school|student|attendance|payroll|recruitment)\s+management(?:\s+system)?|management\s+system|tracking\s+system|capstone|academic\s+project|(?:web|mobile)\s+app|website|dashboard|portal)\b/i;

function isWeakP0AutoFill(key: string, imported: string): boolean {
  const value = imported.trim();
  if (!value) return true;

  if (key === "fullName") {
    if (looksLikeJobTitle(value)) return true;
    if (WEAK_PROJECT_COMPANY_RE.test(value)) return true;
    return false;
  }

  if (key === "headline") {
    if (looksLikeName(value)) return true;
    if (!JOB_TITLE_SIGNAL_RE.test(value)) return true;
    if (WEAK_PROJECT_COMPANY_RE.test(value) && !looksLikeJobTitle(value)) {
      return true;
    }
    return false;
  }

  if (key === "currentTitle") {
    if (/^unknown$/i.test(value)) return true;
    if (looksLikeName(value)) return true;
    if (!looksLikeJobTitle(value)) return true;
    return false;
  }

  if (key === "currentCompany") {
    if (looksLikeName(value)) return true;
    if (looksLikeJobTitle(value)) return true;
    if (WEAK_PROJECT_COMPANY_RE.test(value)) return true;
    return false;
  }

  return false;
}

function isWeakExperienceRow(row: ResumeImportExperienceMapped): boolean {
  const title = row.title?.trim() ?? "";
  const company = row.company?.trim() ?? "";
  if (!title || !company) return true;
  if (/^unknown$/i.test(title)) return true;
  if (!looksLikeJobTitle(title)) return true;
  if (looksLikeName(title)) return true;
  if (
    WEAK_PROJECT_COMPANY_RE.test(company) &&
    !/\b(pvt\.?\s*ltd\.?|ltd\.?|limited|inc\.?|llc|technologies|solutions|softwares?)\b/i.test(
      company
    )
  ) {
    return true;
  }
  return false;
}

const SCALAR_DEFS = (
  candidate: CandidateDetail,
  mapped: ResumeImportMappedDraft
): ScalarDef[] => [
  {
    key: "fullName",
    label: "Full name",
    current: candidate.fullName,
    imported: mapped.personal.fullName,
  },
  {
    key: "firstName",
    label: "First name",
    current: candidate.firstName,
    imported: mapped.personal.firstName,
  },
  {
    key: "lastName",
    label: "Last name",
    current: candidate.lastName,
    imported: mapped.personal.lastName,
  },
  {
    key: "email",
    label: "Email",
    current: candidate.email,
    imported: mapped.personal.email,
  },
  {
    key: "phone",
    label: "Phone",
    current: candidate.phone,
    imported: mapped.personal.phone,
  },
  {
    key: "location",
    label: "Location",
    current: candidate.location,
    imported: mapped.personal.location,
  },
  {
    key: "headline",
    label: "Headline",
    current: candidate.headline,
    imported: mapped.professional.headline,
  },
  {
    key: "professionalSummary",
    label: "Professional summary",
    current: candidate.professionalSummary,
    imported: mapped.professional.professionalSummary,
  },
  {
    key: "currentCompany",
    label: "Current company",
    current: candidate.currentCompany,
    imported: mapped.professional.currentCompany,
  },
  {
    key: "currentTitle",
    label: "Current title",
    current: candidate.currentTitle,
    imported: mapped.professional.currentTitle,
  },
  {
    key: "githubUrl",
    label: "GitHub",
    current: candidate.githubUrl,
    imported: mapped.professional.githubUrl,
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn",
    current: candidate.linkedinUrl,
    imported: mapped.professional.linkedinUrl,
  },
  {
    key: "portfolioUrl",
    label: "Portfolio",
    current: candidate.personal?.portfolioUrl,
    imported: mapped.professional.portfolioUrl,
  },
  {
    key: "totalExperienceYears",
    label: "Total experience (years)",
    current: candidate.totalExperienceYears,
    imported: mapped.professional.totalExperienceYears,
  },
  {
    key: "preferredWorkMode",
    label: "Preferred work mode",
    current: candidate.preferredWorkMode,
    imported: mapped.professional.preferredWorkMode,
  },
  {
    key: "willingToRelocate",
    label: "Willing to relocate",
    current: candidate.willingToRelocate,
    imported: mapped.professional.willingToRelocate,
  },
];

function coerceImportedValue(key: string, raw: unknown): string | number | boolean | null {
  if (raw === null || raw === undefined) return null;
  if (key === "willingToRelocate") {
    if (typeof raw === "boolean") return raw;
    const s = String(raw).toLowerCase().trim();
    if (s === "true" || s === "yes" || s === "1") return true;
    if (s === "false" || s === "no" || s === "0") return false;
    return null;
  }
  if (typeof raw === "number" || typeof raw === "boolean") return raw;
  const text = displayValue(raw);
  return text;
}

function experienceKey(row: {
  company?: string | null;
  companyName?: string | null;
  title?: string | null;
  designation?: string | null;
}): string {
  const company = normalizeComparable(row.companyName ?? row.company);
  const title = normalizeComparable(row.designation ?? row.title);
  return `${company}::${title}`;
}

function educationKey(row: {
  institution?: string | null;
  degree?: string | null;
  field?: string | null;
  fieldOfStudy?: string | null;
}): string {
  return [
    normalizeComparable(row.institution),
    normalizeComparable(row.degree),
    normalizeComparable(row.fieldOfStudy ?? row.field),
  ].join("::");
}

function skillKey(row: { name?: string | null; skillName?: string | null }): string {
  return normalizeComparable(row.skillName ?? row.name);
}

function projectKey(row: {
  title?: string | null;
  url?: string | null;
}): string {
  return `${normalizeComparable(row.title)}::${normalizeComparable(row.url ?? "")}`;
}

function certificationKey(row: {
  name?: string | null;
  issuer?: string | null;
}): string {
  return `${normalizeComparable(row.name)}::${normalizeComparable(row.issuer ?? "")}`;
}

/**
 * Pure merge planner — does not write to the database.
 *
 * Rules:
 * - Empty + resume value → autoFill
 * - Same → ignore
 * - Different → conflict
 * - Experiences / educations / skills / projects / certifications → append only, skip duplicates
 */
export function buildResumeMergeResult(
  candidate: CandidateDetail,
  mapped: ResumeImportMappedDraft
): ResumeMergeResult {
  const autoFill: ResumeMergeResult["autoFill"] = {};
  const conflicts: ResumeMergeConflict[] = [];

  for (const def of SCALAR_DEFS(candidate, mapped)) {
    const current = displayValue(def.current);
    const imported = displayValue(def.imported);

    if (!imported) continue;

    if (!current) {
      if (
        P0_AUTOFILL_KEYS.has(def.key) &&
        isWeakP0AutoFill(def.key, imported)
      ) {
        // Missing is better than wrong — leave empty for HR review.
        continue;
      }
      autoFill[def.key] = coerceImportedValue(def.key, def.imported);
      continue;
    }

    if (normalizeComparable(current) === normalizeComparable(imported)) {
      continue;
    }

    conflicts.push({
      key: def.key,
      label: def.label,
      currentValue: current,
      parsedValue: imported,
    });
  }

  const existingExperienceKeys = new Set(
    (candidate.experiences ?? []).map((e) => experienceKey(e))
  );
  const experiencesToAppend = (mapped.experiences ?? []).filter((row) => {
    if (!row.company?.trim() || !row.title?.trim()) return false;
    if (isWeakExperienceRow(row)) return false;
    return !existingExperienceKeys.has(experienceKey(row));
  });

  const existingEducationKeys = new Set(
    (candidate.educations ?? []).map((e) => educationKey(e))
  );
  const educationsToAppend = (mapped.educations ?? []).filter((row) => {
    if (!row.institution?.trim()) return false;
    return !existingEducationKeys.has(educationKey(row));
  });

  const existingSkillKeys = new Set((candidate.skills ?? []).map((s) => skillKey(s)));
  const skillsToAppend = (mapped.skills ?? []).filter((row) => {
    if (!row.name?.trim()) return false;
    return !existingSkillKeys.has(skillKey(row));
  });

  const existingProjectKeys = new Set(
    (candidate.projects ?? []).map((p) => projectKey(p))
  );
  const projectsToAppend = (mapped.projects ?? []).filter((row) => {
    if (!row.title?.trim()) return false;
    return !existingProjectKeys.has(projectKey(row));
  });

  const existingCertificationKeys = new Set(
    (candidate.certifications ?? []).map((c) => certificationKey(c))
  );
  const certificationsToAppend = (mapped.certifications ?? []).filter((row) => {
    if (!row.name?.trim()) return false;
    return !existingCertificationKeys.has(certificationKey(row));
  });

  return {
    autoFill,
    conflicts,
    experiencesToAppend,
    educationsToAppend,
    skillsToAppend,
    projectsToAppend,
    certificationsToAppend,
  };
}

/** Resolve conflict choices into scalar values to write. */
export function resolveConflictSelections(
  conflicts: ResumeMergeConflict[],
  selections: Record<string, "current" | "parsed">
): Record<string, string | number | boolean | null> {
  const patch: Record<string, string | number | boolean | null> = {};
  for (const conflict of conflicts) {
    const choice = selections[conflict.key] ?? "current";
    if (choice !== "parsed") continue;
    patch[conflict.key] = coerceImportedValue(conflict.key, conflict.parsedValue);
  }
  return patch;
}

export function resumeMergeHasWork(result: ResumeMergeResult): boolean {
  return (
    Object.keys(result.autoFill).length > 0 ||
    result.conflicts.length > 0 ||
    result.experiencesToAppend.length > 0 ||
    result.educationsToAppend.length > 0 ||
    result.skillsToAppend.length > 0 ||
    result.projectsToAppend.length > 0 ||
    result.certificationsToAppend.length > 0
  );
}
