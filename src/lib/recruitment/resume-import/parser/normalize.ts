import { normalizeComparable } from "@/lib/recruitment/resume-import/draft-content";
import { normalizeWhitespace, titleCaseName } from "./cleanup";
import { normalizePhone, normalizeResumeDate } from "./patterns";
import type { ParsedResumeDraft } from "./types";

function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Normalize + dedupe parsed resume data before merge engine.
 */
export function normalizeParsedResumeDraft(draft: ParsedResumeDraft): ParsedResumeDraft {
  const fullName = draft.personal.fullName
    ? titleCaseName(draft.personal.fullName)
    : null;

  const skills = dedupeByKey(
    draft.skills
      .map((s) => normalizeWhitespace(s))
      .filter((s) => s.length > 0),
    (s) => normalizeComparable(s)
  );

  const educations = dedupeByKey(
    draft.educations.map((e) => ({
      institution: normalizeWhitespace(e.institution),
      degree: e.degree ? normalizeWhitespace(e.degree) : null,
      graduationYear: e.graduationYear,
    })),
    (e) =>
      [
        normalizeComparable(e.institution),
        normalizeComparable(e.degree),
        String(e.graduationYear ?? ""),
      ].join("::")
  );

  const experiences = dedupeByKey(
    draft.experiences.map((e) => ({
      company: normalizeWhitespace(e.company),
      title: normalizeWhitespace(e.title),
      startDate: normalizeResumeDate(e.startDate),
      endDate: e.isCurrent ? null : normalizeResumeDate(e.endDate),
      isCurrent: e.isCurrent,
      description: e.description ? normalizeWhitespace(e.description) : null,
    })),
    (e) =>
      [
        normalizeComparable(e.company),
        normalizeComparable(e.title),
        e.startDate ?? "",
      ].join("::")
  );

  return {
    personal: {
      fullName,
      email: draft.personal.email?.toLowerCase().trim() || null,
      phone: draft.personal.phone
        ? normalizePhone(draft.personal.phone) ?? draft.personal.phone
        : null,
      location: draft.personal.location
        ? normalizeWhitespace(draft.personal.location)
        : null,
      linkedinUrl: draft.personal.linkedinUrl?.trim() || null,
    },
    professional: {
      currentCompany: draft.professional.currentCompany
        ? normalizeWhitespace(draft.professional.currentCompany)
        : null,
      currentTitle: draft.professional.currentTitle
        ? normalizeWhitespace(draft.professional.currentTitle)
        : null,
      totalExperienceYears: draft.professional.totalExperienceYears?.trim() || null,
      summary: draft.professional.summary
        ? normalizeWhitespace(draft.professional.summary)
        : null,
    },
    experiences,
    educations,
    skills,
  };
}
