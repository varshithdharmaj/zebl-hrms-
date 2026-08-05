import type {
  ResumeImportDraftContent,
  ResumeImportMappedDraft,
} from "@/lib/recruitment/resume-import/types";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse and lightly validate insight contentJson. */
export function parseResumeImportDraftContent(raw: unknown): ResumeImportDraftContent {
  if (!isObject(raw)) {
    throw new RecruitmentDomainError("REC_VALIDATION", "Invalid resume import draft payload.");
  }
  if (raw.version !== 1) {
    throw new RecruitmentDomainError("REC_VALIDATION", "Unsupported resume import draft version.");
  }
  if (!isObject(raw.mapped)) {
    throw new RecruitmentDomainError("REC_VALIDATION", "Resume import draft is missing mapped data.");
  }

  const mapped = raw.mapped as ResumeImportMappedDraft;
  return {
    version: 1,
    source: (raw.source as ResumeImportDraftContent["source"]) ?? "stub",
    documentId: typeof raw.documentId === "string" ? raw.documentId : null,
    raw: isObject(raw.raw) ? raw.raw : {},
    mapped: {
      personal: (mapped.personal ?? {}) as ResumeImportMappedDraft["personal"],
      professional: (mapped.professional ?? {}) as ResumeImportMappedDraft["professional"],
      experiences: Array.isArray(mapped.experiences) ? mapped.experiences : [],
      educations: Array.isArray(mapped.educations) ? mapped.educations : [],
      skills: Array.isArray(mapped.skills) ? mapped.skills : [],
      projects: Array.isArray(mapped.projects) ? mapped.projects : [],
      certifications: Array.isArray(mapped.certifications) ? mapped.certifications : [],
    },
    fieldConfidence: isObject(raw.fieldConfidence)
      ? (raw.fieldConfidence as Record<string, number>)
      : {},
    metadata: isObject(raw.metadata)
      ? (raw.metadata as ResumeImportDraftContent["metadata"])
      : {},
  };
}

export function displayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export function normalizeComparable(value: unknown): string {
  return (displayValue(value) ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}
