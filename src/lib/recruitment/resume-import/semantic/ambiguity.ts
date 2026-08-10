/**
 * Deterministic ambiguity detection for selective LLM verification.
 * No confidence theater — concrete structural evidence only.
 */

import { splitResumeLines } from "../parser/cleanup";
import { detectResumeSections } from "../parser/sections";
import {
  JOB_TITLE_SIGNAL_RE,
  looksLikeHeadline,
  looksLikeJobTitle,
  looksLikeName,
} from "../parser/patterns";
import type { ParsedResumeDraft } from "../parser/types";

export type ResumeAmbiguityReason =
  | "weak_experience"
  | "experience_project_ambiguity"
  | "education_ambiguity"
  | "project_ambiguity"
  | "headline_ambiguity"
  | "current_role_ambiguity"
  | "section_ambiguity"
  | "entity_association_ambiguity";

export type ResumeAmbiguitySpan = {
  section: string;
  text: string;
  candidateIds: string[];
};

export type ResumeAmbiguity = {
  needsVerification: boolean;
  reasons: ResumeAmbiguityReason[];
  spans: ResumeAmbiguitySpan[];
};

const PROJECT_LIKE_RE =
  /\b((?:employee|library|inventory|hospital|school|student)\s+management(?:\s+system)?|management\s+system|capstone|academic\s+project|(?:web|mobile)\s+app|portal|dashboard)\b/i;

const MAX_SPAN_CHARS = 3500;

function clip(text: string, max = MAX_SPAN_CHARS): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…[truncated]`;
}

function pushReason(
  reasons: ResumeAmbiguityReason[],
  reason: ResumeAmbiguityReason
): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

/**
 * Detect whether the normalized draft has ambiguity worth selective LLM review.
 * Strong, dated employment records do not trigger verification by themselves.
 */
export function detectResumeAmbiguity(input: {
  draft: ParsedResumeDraft;
  cleanedText: string;
  warnings?: string[];
}): ResumeAmbiguity {
  const { draft, cleanedText } = input;
  const warnings = input.warnings ?? [];
  const reasons: ResumeAmbiguityReason[] = [];
  const spans: ResumeAmbiguitySpan[] = [];

  const lines = splitResumeLines(cleanedText);
  const { sections } = detectResumeSections(lines);

  // --- Experience ---
  const expSection = sections.experience;
  if (expSection.length > 0 && draft.experiences.length === 0) {
    pushReason(reasons, "weak_experience");
    spans.push({
      section: "experience",
      text: clip(expSection.join("\n")),
      candidateIds: [],
    });
  }

  for (let i = 0; i < draft.experiences.length; i++) {
    const exp = draft.experiences[i]!;
    const id = `exp:${i}`;
    const projectLike =
      PROJECT_LIKE_RE.test(exp.company) || PROJECT_LIKE_RE.test(exp.title);
    const titleWeak = !looksLikeJobTitle(exp.title);

    if (projectLike) {
      pushReason(reasons, "experience_project_ambiguity");
      spans.push({
        section: "experience",
        text: clip(
          [`${exp.title} @ ${exp.company}`, exp.description ?? ""]
            .filter(Boolean)
            .join("\n")
        ),
        candidateIds: [id],
      });
    } else if (titleWeak) {
      // Weak title alone is enough; dated Title@Company with real title signals stay deterministic.
      pushReason(reasons, "weak_experience");
      spans.push({
        section: "experience",
        text: clip(`${exp.title} @ ${exp.company}`),
        candidateIds: [id],
      });
    }
  }

  // Project titles that match experience companies (association conflict)
  for (let i = 0; i < draft.projects.length; i++) {
    const p = draft.projects[i]!;
    const hit = draft.experiences.some(
      (e) =>
        e.company.toLowerCase() === p.title.toLowerCase() ||
        e.title.toLowerCase() === p.title.toLowerCase()
    );
    if (hit) {
      pushReason(reasons, "entity_association_ambiguity");
      spans.push({
        section: "projects",
        text: clip(p.title),
        candidateIds: [`proj:${i}`],
      });
    }
  }

  // --- Projects ---
  if (sections.projects.length > 0 && draft.projects.length === 0) {
    pushReason(reasons, "project_ambiguity");
    spans.push({
      section: "projects",
      text: clip(sections.projects.join("\n")),
      candidateIds: [],
    });
  }

  for (let i = 0; i < draft.projects.length; i++) {
    const p = draft.projects[i]!;
    const id = `proj:${i}`;
    const weakTitle =
      p.title.length < 3 ||
      /^(built|developed|created|led)\b/i.test(p.title) ||
      looksLikeJobTitle(p.title);
    // Long prose titles without tech/summary are noisy but usually still projects —
    // only escalate when title itself looks non-project (job-title-like / verb lead-in).
    if (weakTitle) {
      pushReason(reasons, "project_ambiguity");
      spans.push({
        section: "projects",
        text: clip(
          [p.title, p.summary ?? "", p.techStack ?? ""].filter(Boolean).join("\n")
        ),
        candidateIds: [id],
      });
    }
  }

  // --- Education ---
  if (sections.education.length > 0 && draft.educations.length === 0) {
    pushReason(reasons, "education_ambiguity");
    spans.push({
      section: "education",
      text: clip(sections.education.join("\n")),
      candidateIds: [],
    });
  }

  for (let i = 0; i < draft.educations.length; i++) {
    const e = draft.educations[i]!;
    const id = `edu:${i}`;
    const degreeOnly =
      e.degree &&
      (!e.institution ||
        e.institution.length < 3 ||
        JOB_TITLE_SIGNAL_RE.test(e.institution));
    const institutionOnly = e.institution && !e.degree && !e.graduationYear;
    if (degreeOnly || institutionOnly) {
      pushReason(reasons, "education_ambiguity");
      spans.push({
        section: "education",
        text: clip(
          [e.degree, e.institution, e.field, e.graduationYear]
            .filter((x) => x !== null && x !== undefined && String(x).length)
            .join(" | ")
        ),
        candidateIds: [id],
      });
    }
  }

  // --- Current role ---
  const currentMarked = draft.experiences.filter((e) => e.isCurrent);
  if (currentMarked.length > 1) {
    pushReason(reasons, "current_role_ambiguity");
    spans.push({
      section: "experience",
      text: clip(
        currentMarked.map((e) => `${e.title} @ ${e.company}`).join("\n")
      ),
      candidateIds: draft.experiences
        .map((e, i) => (e.isCurrent ? `exp:${i}` : null))
        .filter((x): x is string => Boolean(x)),
    });
  }

  if (
    draft.experiences.length >= 2 &&
    !draft.professional.currentTitle &&
    !draft.professional.currentCompany &&
    draft.experiences.every((e) => !e.isCurrent)
  ) {
    const dated = draft.experiences.filter((e) => e.startDate || e.endDate);
    if (dated.length >= 2) {
      pushReason(reasons, "current_role_ambiguity");
      spans.push({
        section: "experience",
        text: clip(
          draft.experiences
            .map(
              (e) =>
                `${e.title} @ ${e.company} (${e.startDate ?? "?"}–${e.endDate ?? (e.isCurrent ? "Present" : "?")})`
            )
            .join("\n")
        ),
        candidateIds: ["current_role"],
      });
    }
  }

  // --- Headline ---
  // Trigger only when missing AND multiple plausible header lines compete
  // (true ambiguity). A single clear headline candidate stays deterministic-empty.
  if (!draft.professional.headline) {
    const headerish = lines.slice(0, 20);
    const name = draft.personal.fullName?.toLowerCase() ?? "";
    const candidates = headerish.filter((line) => {
      if (name && line.toLowerCase() === name) return false;
      if (looksLikeName(line)) return false;
      return looksLikeHeadline(line);
    });
    const unique = [...new Set(candidates.map((c) => c.toLowerCase()))];
    if (unique.length >= 2) {
      pushReason(reasons, "headline_ambiguity");
      spans.push({
        section: "header",
        text: clip(headerish.join("\n")),
        candidateIds: ["headline"],
      });
    }
  }

  // --- Section / other ---
  // Only escalate leftover "other" when it looks like misclassified employment / education /
  // project content — not merely because a resume has extra prose.
  const otherText = sections.other.join("\n").trim();
  if (otherText.length > 400) {
    const otherLooksStructural =
      (JOB_TITLE_SIGNAL_RE.test(otherText) &&
        /\b(at|@|present|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})\b/i.test(
          otherText
        )) ||
      /\b(university|college|bachelor|master|b\.?tech|m\.?tech|mba)\b/i.test(otherText) ||
      PROJECT_LIKE_RE.test(otherText);
    if (otherLooksStructural) {
      pushReason(reasons, "section_ambiguity");
      spans.push({
        section: "other",
        text: clip(otherText),
        candidateIds: [],
      });
    }
  }

  if (
    warnings.some((w) => /experience section found but no structured/i.test(w))
  ) {
    pushReason(reasons, "weak_experience");
  }

  // Deduplicate spans by section+candidateIds key
  const seen = new Set<string>();
  const uniqueSpans = spans.filter((s) => {
    const key = `${s.section}::${s.candidateIds.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    needsVerification: reasons.length > 0,
    reasons,
    spans: uniqueSpans.slice(0, 12),
  };
}
