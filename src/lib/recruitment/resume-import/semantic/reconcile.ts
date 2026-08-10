import { normalizeWhitespace } from "../parser/cleanup";
import { looksLikeName } from "../parser/patterns";
import type { ParsedResumeDraft, ParsedResumeExperience, ParsedResumeProject } from "../parser/types";
import type { SemanticVerificationDecision, SemanticVerificationResult } from "./llm-verify-schema";

export type EvidenceState = "strong" | "ambiguous" | "unsupported";

export type ReconciliationOutcome = {
  draft: ParsedResumeDraft;
  accepted: number;
  rejected: number;
  unsupported: number;
  notes: string[];
};

function normHay(text: string): string {
  return normalizeWhitespace(text).toLowerCase();
}

function evidenceInSource(evidence: string[], sourceText: string): boolean {
  const hay = normHay(sourceText);
  return evidence.every((e) => {
    const needle = normHay(e);
    if (needle.length < 3) return false;
    return hay.includes(needle);
  });
}

function parseExpIndex(candidateId: string | null): number | null {
  if (!candidateId) return null;
  const m = /^exp:(\d+)$/.exec(candidateId);
  return m ? Number(m[1]) : null;
}

function parseProjIndex(candidateId: string | null): number | null {
  if (!candidateId) return null;
  const m = /^proj:(\d+)$/.exec(candidateId);
  return m ? Number(m[1]) : null;
}

function parseEduIndex(candidateId: string | null): number | null {
  if (!candidateId) return null;
  const m = /^edu:(\d+)$/.exec(candidateId);
  return m ? Number(m[1]) : null;
}

function selectCurrentFromExperiences(
  experiences: ParsedResumeExperience[]
): { currentTitle: string | null; currentCompany: string | null } {
  const marked = experiences.find((e) => e.isCurrent);
  if (marked) {
    return { currentTitle: marked.title, currentCompany: marked.company };
  }
  const openEnded = experiences.filter((e) => e.startDate && !e.endDate);
  if (openEnded.length === 0) {
    return { currentTitle: null, currentCompany: null };
  }
  const rank = (e: ParsedResumeExperience): number => {
    const start = e.startDate ?? "0000-01-01";
    return Date.parse(start) || 0;
  };
  const best = [...openEnded].sort((a, b) => rank(b) - rank(a))[0];
  if (!best) return { currentTitle: null, currentCompany: null };
  return { currentTitle: best.title, currentCompany: best.company };
}

function experienceToProject(exp: ParsedResumeExperience): ParsedResumeProject {
  return {
    title: exp.company || exp.title,
    summary: exp.description,
    techStack: null,
    url: null,
    duration: exp.startDate
      ? `${exp.startDate}${exp.endDate ? ` – ${exp.endDate}` : exp.isCurrent ? " – Present" : ""}`
      : null,
  };
}

/**
 * Apply LLM verification decisions deterministically.
 * LLM never invents new employers/titles — only accept/reject/reclassify/leave_empty
 * on existing deterministic candidates, with source evidence required.
 */
export function reconcileSemanticVerification(input: {
  draft: ParsedResumeDraft;
  verification: SemanticVerificationResult;
  sourceText: string;
}): ReconciliationOutcome {
  const draft: ParsedResumeDraft = structuredClone(input.draft);
  const notes: string[] = [];
  let accepted = 0;
  let rejected = 0;
  let unsupported = 0;

  const name = draft.personal.fullName;

  const removeExp = new Set<number>();
  const removeProj = new Set<number>();
  const removeEdu = new Set<number>();
  const reclassExpToProj = new Set<number>();

  const consider = (d: SemanticVerificationDecision): boolean => {
    if (!evidenceInSource(d.evidence, input.sourceText)) {
      unsupported += 1;
      notes.push(`unsupported:${d.type}:${d.candidateId ?? "null"}:evidence`);
      return false;
    }

    // Name must never become headline / title / company / project via LLM.
    if (
      name &&
      d.evidence.some((e) => looksLikeName(e) && normHay(e) === normHay(name))
    ) {
      if (d.type === "headline" && d.action !== "leave_empty" && d.action !== "reject") {
        rejected += 1;
        notes.push("rejected:name_as_headline_evidence");
        return false;
      }
    }

    if (d.type === "headline" && d.action === "accept" && name) {
      // Accepting headline only means keep deterministic headline if present; never invent.
      if (!draft.professional.headline) {
        rejected += 1;
        notes.push("rejected:headline_accept_without_deterministic_value");
        return false;
      }
      if (normHay(draft.professional.headline) === normHay(name)) {
        draft.professional.headline = null;
        rejected += 1;
        notes.push("rejected:headline_equals_name");
        return false;
      }
    }

    return true;
  };

  for (const d of input.verification.decisions) {
    if (!consider(d)) continue;

    if (d.type === "headline") {
      if (d.action === "leave_empty" || d.action === "reject") {
        draft.professional.headline = null;
        accepted += 1;
        continue;
      }
      if (d.action === "accept") {
        accepted += 1;
        continue;
      }
      rejected += 1;
      notes.push(`rejected:headline:${d.action}`);
      continue;
    }

    if (d.type === "current_role") {
      if (d.action === "leave_empty" || d.action === "reject") {
        draft.professional.currentTitle = null;
        draft.professional.currentCompany = null;
        accepted += 1;
        continue;
      }
      if (d.action === "accept") {
        accepted += 1;
        continue;
      }
      rejected += 1;
      notes.push(`rejected:current_role:${d.action}`);
      continue;
    }

    if (d.type === "experience") {
      const idx = parseExpIndex(d.candidateId);
      if (idx === null || !draft.experiences[idx]) {
        unsupported += 1;
        notes.push(`unsupported:experience:bad_id:${d.candidateId}`);
        continue;
      }
      if (d.action === "accept") {
        accepted += 1;
        continue;
      }
      if (d.action === "reject" || d.action === "leave_empty") {
        removeExp.add(idx);
        accepted += 1;
        continue;
      }
      if (d.action === "reclassify") {
        if (d.proposedSection === "projects") {
          reclassExpToProj.add(idx);
          accepted += 1;
          continue;
        }
        // Reclassify to education/other without inventing — just drop from experience.
        if (
          d.proposedSection === "education" ||
          d.proposedSection === "other" ||
          d.proposedSection === "summary"
        ) {
          removeExp.add(idx);
          accepted += 1;
          continue;
        }
        rejected += 1;
        notes.push(`rejected:experience_reclassify:${d.proposedSection}`);
        continue;
      }
    }

    if (d.type === "project") {
      const idx = parseProjIndex(d.candidateId);
      if (idx === null || !draft.projects[idx]) {
        unsupported += 1;
        notes.push(`unsupported:project:bad_id:${d.candidateId}`);
        continue;
      }
      if (d.action === "accept") {
        accepted += 1;
        continue;
      }
      if (d.action === "reject" || d.action === "leave_empty") {
        removeProj.add(idx);
        accepted += 1;
        continue;
      }
      if (d.action === "reclassify" && d.proposedSection === "experience") {
        // Never promote project → experience without employment evidence — reject.
        rejected += 1;
        notes.push("rejected:project_to_experience");
        continue;
      }
      if (d.action === "reclassify") {
        removeProj.add(idx);
        accepted += 1;
        continue;
      }
    }

    if (d.type === "education") {
      const idx = parseEduIndex(d.candidateId);
      if (idx === null || !draft.educations[idx]) {
        unsupported += 1;
        notes.push(`unsupported:education:bad_id:${d.candidateId}`);
        continue;
      }
      if (d.action === "accept") {
        accepted += 1;
        continue;
      }
      if (d.action === "reject" || d.action === "leave_empty") {
        removeEdu.add(idx);
        accepted += 1;
        continue;
      }
      if (d.action === "reclassify" && d.proposedSection === "experience") {
        rejected += 1;
        notes.push("rejected:education_to_experience");
        continue;
      }
      if (d.action === "reclassify") {
        removeEdu.add(idx);
        accepted += 1;
        continue;
      }
    }

    if (d.type === "section") {
      // Section advice is advisory only for Phase B — do not invent entities.
      if (d.action === "accept" || d.action === "leave_empty") {
        accepted += 1;
        continue;
      }
      rejected += 1;
      notes.push(`rejected:section:${d.action}`);
      continue;
    }

    rejected += 1;
    notes.push(`rejected:unhandled:${d.type}:${d.action}`);
  }

  // Apply removals / reclassifications (highest index first)
  for (const idx of [...reclassExpToProj].sort((a, b) => b - a)) {
    const exp = draft.experiences[idx];
    if (!exp) continue;
    draft.projects.unshift(experienceToProject(exp));
    draft.experiences.splice(idx, 1);
  }
  for (const idx of [...removeExp].sort((a, b) => b - a)) {
    if (draft.experiences[idx]) draft.experiences.splice(idx, 1);
  }
  for (const idx of [...removeProj].sort((a, b) => b - a)) {
    if (draft.projects[idx]) draft.projects.splice(idx, 1);
  }
  for (const idx of [...removeEdu].sort((a, b) => b - a)) {
    if (draft.educations[idx]) draft.educations.splice(idx, 1);
  }

  // Final name/headline safety
  if (
    draft.personal.fullName &&
    draft.professional.headline &&
    normHay(draft.personal.fullName) === normHay(draft.professional.headline)
  ) {
    draft.professional.headline = null;
    notes.push("cleared:headline_equals_name");
  }

  // Refresh current role from remaining experiences (never experiences[0] blind guess)
  const current = selectCurrentFromExperiences(draft.experiences);
  // Only overwrite if we still have experiences; leave_empty decisions already cleared.
  if (draft.experiences.length > 0) {
    const hadExplicitLeave = input.verification.decisions.some(
      (d) =>
        d.type === "current_role" &&
        (d.action === "leave_empty" || d.action === "reject")
    );
    if (!hadExplicitLeave) {
      draft.professional.currentTitle = current.currentTitle;
      draft.professional.currentCompany = current.currentCompany;
    }
  } else {
    draft.professional.currentTitle = null;
    draft.professional.currentCompany = null;
  }

  return { draft, accepted, rejected, unsupported, notes };
}

export function evidenceStateFromAmbiguity(needsVerification: boolean): EvidenceState {
  return needsVerification ? "ambiguous" : "strong";
}
