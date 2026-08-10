/**
 * Resume corpus accuracy benchmark (evaluation only).
 *
 * Usage (from ZEBL_AMS):
 *   npm run bench:resumes
 *   PHASE_B_LLM=1 npm run bench:resumes   # also call Gemini on ambiguous resumes
 *
 * Does NOT write to the database.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";

function loadEnvFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

import { cleanupResumeText, splitResumeLines } from "../src/lib/recruitment/resume-import/parser/cleanup";
import { extractResumeText } from "../src/lib/recruitment/resume-import/parser/extract-text";
import { normalizeParsedResumeDraft } from "../src/lib/recruitment/resume-import/parser/normalize";
import { parseResumeFromCleanText } from "../src/lib/recruitment/resume-import/parser/parse-resume";
import { matchSectionHeader } from "../src/lib/recruitment/resume-import/parser/sections";
import { mappedDraftFromParsed } from "../src/lib/recruitment/resume-import/parser/to-draft-content";
import { detectResumeAmbiguity } from "../src/lib/recruitment/resume-import/semantic/ambiguity";
import { runSemanticVerificationPipeline } from "../src/lib/recruitment/resume-import/semantic";
import type { ParsedResumeDraft } from "../src/lib/recruitment/resume-import/parser/types";
import type { SemanticVerificationDecision } from "../src/lib/recruitment/resume-import/semantic/llm-verify-schema";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const AMS_ROOT = resolve(process.cwd());
const CORPUS_ROOT = resolve(AMS_ROOT, "..", "synthetic-resumes");
const BENCHMARK_DIR = join(CORPUS_ROOT, "benchmark-set");
const LEGACY_DIR = CORPUS_ROOT;
const GROUND_TRUTH_PATH = join(BENCHMARK_DIR, "ground-truth.json");
const OUT_DIR = join(CORPUS_ROOT, "benchmark-results");
const REVIEW_DIR = join(OUT_DIR, "human-review");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GroundEmployment = {
  title: string;
  company: string;
  location?: string | null;
  start?: string | null;
  end?: string | null;
};

type GroundEducation = {
  degree?: string | null;
  institution: string;
  years?: string | null;
};

type GroundProject = {
  name: string;
  tech?: string | null;
  description?: string | null;
};

type GroundTruth = {
  id: string;
  file_base: string;
  role: string;
  template_style: string;
  completeness: string;
  parser_focus: string;
  full_name: string;
  location: string | null;
  headline: string | null;
  current_company: string | null;
  designation: string | null;
  employment: GroundEmployment[];
  education: GroundEducation[];
  skills_flat: string[];
  projects: GroundProject[];
  certifications: string[];
};

type FailureCode =
  | "NAME_WRONG"
  | "HEADLINE_WRONG"
  | "LOCATION_WRONG"
  | "CURRENT_COMPANY_WRONG"
  | "CURRENT_TITLE_WRONG"
  | "EXPERIENCE_WRONG"
  | "PROJECT_AS_EXPERIENCE"
  | "EDUCATION_AS_EXPERIENCE"
  | "CERTIFICATION_AS_EXPERIENCE"
  | "EXPERIENCE_AS_PROJECT"
  | "EDUCATION_WRONG"
  | "SKILL_WRONG"
  | "PROJECT_WRONG"
  | "CERTIFICATION_WRONG"
  | "COMPANY_TITLE_SWAPPED"
  | "CURRENT_ROLE_WRONG"
  | "PDF_READING_ORDER"
  | "SECTION_DETECTION"
  | "TEXT_EXTRACTION"
  | "FIELD_MISSING"
  | "FIELD_FALSE_POSITIVE";

type Layer = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
type Severity = "P0" | "P1" | "P2";

type Failure = {
  code: FailureCode;
  layer: Layer;
  severity: Severity;
  evidence: string;
};

type FieldScore = {
  expectedPresent: boolean;
  actualPresent: boolean;
  correct: boolean | null; // null = cannot score (missing both OK for optional)
  emptyOk: boolean;
};

type ListScore = {
  expected: number;
  actual: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
};

type ResumeEval = {
  file: string;
  stem: string;
  type: "pdf" | "docx";
  corpus: "benchmark-set" | "legacy";
  layoutHints: string[];
  validationStatus: "VALIDATED" | "UNVALIDATED_NEEDS_HUMAN_LABELING";
  extraction: {
    ok: boolean;
    textLength: number;
    empty: boolean;
    errorCode?: string;
    errorMessage?: string;
  };
  sections: string[];
  warnings: string[];
  /** Redacted parsed snapshot — no email/phone. */
  parsed: {
    name: string | null;
    headline: string | null;
    location: string | null;
    currentCompany: string | null;
    currentTitle: string | null;
    experienceCount: number;
    educationCount: number;
    skillCount: number;
    projectCount: number;
    certificationCount: number;
    experiences: Array<{ title: string; company: string; isCurrent: boolean }>;
    educations: Array<{ institution: string; degree: string | null }>;
    projects: Array<{ title: string }>;
    skillsSample: string[];
    certificationsSample: string[];
  };
  scores?: {
    name: FieldScore;
    headline: FieldScore;
    location: FieldScore;
    currentCompany: FieldScore;
    currentTitle: FieldScore;
    experiences: ListScore;
    educations: ListScore;
    skills: ListScore;
    projects: ListScore;
    certifications: ListScore;
  };
  failures: Failure[];
  assignmentStats: {
    evaluatedAssignments: number;
    wrongAssignments: number;
    emptyFields: number;
    scoredFields: number;
  };
  /** Phase B observability (no PII). */
  semantic?: {
    needsVerification: boolean;
    reasons: string[];
    attempted: boolean;
    skipped: boolean;
    skipReason: string | null;
    llmSuccess: boolean | null;
    llmError: string | null;
    decisionCount: number;
    accepted: number;
    rejected: number;
    unsupported: number;
    fallbackDeterministic: boolean;
    latencyMs: number | null;
    retries: number;
    timedOut: boolean;
    usage: {
      inputTokens: number | null;
      outputTokens: number | null;
      totalTokens: number | null;
    } | null;
    leaveEmptyCount: number;
    reclassifyCount: number;
    decisions: Array<{
      type: string;
      action: string;
      candidateId: string | null;
      reason: string;
      evidence: string[];
      proposedSection: string | null;
    }>;
    reconcileNotes: string[];
    impact: "useful" | "harmful" | "noop" | "n/a" | "failed";
  };
  latency?: {
    deterministicMs: number;
    llmMs: number | null;
    totalMs: number;
  };
  /** Deterministic-only scores before reconciliation (validated rows). */
  scoresDeterministic?: ResumeEval["scores"];
  assignmentStatsDeterministic?: ResumeEval["assignmentStats"];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mimeFor(fileName: string): string {
  return fileName.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLoose(value: string): string {
  return norm(value).replace(/\s+/g, "");
}

/** Semantic equality: exact norm, containment, or punctuation-insensitive. */
function softEqual(a: unknown, b: unknown): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (stripLoose(na) === stripLoose(nb)) return true;
  // Containment only when both sides are reasonably long (avoid "java" ⊆ "javascript")
  if (na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  return false;
}

function skillEqual(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || stripLoose(na) === stripLoose(nb)) return true;
  // Token overlap for "AWS (EC2, EKS)" vs "AWS"
  const ta = new Set(na.split(" ").filter((t) => t.length > 1));
  const tb = new Set(nb.split(" ").filter((t) => t.length > 1));
  if (ta.size === 0 || tb.size === 0) return false;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
  const minSize = Math.min(ta.size, tb.size);
  return overlap >= Math.max(1, Math.ceil(minSize * 0.6));
}

function detectSections(text: string): string[] {
  const headers = splitResumeLines(cleanupResumeText(text))
    .map((line) => matchSectionHeader(line))
    .filter((h): h is NonNullable<typeof h> => Boolean(h) && h !== "ignore");
  return [...new Set(headers)];
}

function layoutHintsFromStyle(style: string | undefined, focus: string | undefined): string[] {
  const hints: string[] = [];
  const s = (style ?? "").toLowerCase();
  const f = (focus ?? "").toLowerCase();
  if (s === "sidebar" || f.includes("two-column") || f.includes("table")) {
    hints.push("two-column", "table-heavy");
  }
  if (s === "sparse" || s === "simple") hints.push("minimal");
  if (s === "dense") hints.push("text-heavy");
  if (s === "messy") hints.push("messy-formatting");
  if (s === "clean") hints.push("single-column", "text-heavy");
  if (f.includes("internship")) hints.push("internship-heavy");
  if (f.includes("project")) hints.push("project-heavy");
  if (!hints.length) hints.push("unclassified");
  return hints;
}

function redactEmail(text: string): string {
  return text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
}

function fieldScore(
  expected: string | null | undefined,
  actual: string | null | undefined,
  opts?: { optionalWhenExpectedEmpty?: boolean }
): FieldScore {
  const exp = (expected ?? "").trim();
  const act = (actual ?? "").trim();
  const expectedPresent = exp.length > 0;
  const actualPresent = act.length > 0;
  if (!expectedPresent && !actualPresent) {
    return {
      expectedPresent: false,
      actualPresent: false,
      correct: opts?.optionalWhenExpectedEmpty === false ? null : true,
      emptyOk: true,
    };
  }
  if (!expectedPresent && actualPresent) {
    return {
      expectedPresent: false,
      actualPresent: true,
      correct: false,
      emptyOk: false,
    };
  }
  if (expectedPresent && !actualPresent) {
    return {
      expectedPresent: true,
      actualPresent: false,
      correct: false,
      emptyOk: true,
    };
  }
  return {
    expectedPresent: true,
    actualPresent: true,
    correct: softEqual(exp, act),
    emptyOk: false,
  };
}

function matchList<TExp, TAct>(
  expected: TExp[],
  actual: TAct[],
  equal: (e: TExp, a: TAct) => boolean
): ListScore {
  const used = new Set<number>();
  let tp = 0;
  for (const e of expected) {
    const idx = actual.findIndex((a, i) => !used.has(i) && equal(e, a));
    if (idx >= 0) {
      used.add(idx);
      tp += 1;
    }
  }
  return {
    expected: expected.length,
    actual: actual.length,
    truePositive: tp,
    falsePositive: actual.length - tp,
    falseNegative: expected.length - tp,
  };
}

function precision(tp: number, fp: number): number | null {
  const den = tp + fp;
  return den === 0 ? null : tp / den;
}

function recall(tp: number, fn: number): number | null {
  const den = tp + fn;
  return den === 0 ? null : tp / den;
}

function pct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "n/a";
  return `${(n * 100).toFixed(1)}%`;
}

function hashId(file: string): string {
  return createHash("sha256").update(file).digest("hex").slice(0, 10);
}

// ---------------------------------------------------------------------------
// Corpus discovery
// ---------------------------------------------------------------------------

function listResumeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => {
      const ext = extname(f).toLowerCase();
      return ext === ".pdf" || ext === ".docx";
    })
    .sort();
}

function loadGroundTruth(): Map<string, GroundTruth> {
  const map = new Map<string, GroundTruth>();
  if (!existsSync(GROUND_TRUTH_PATH)) return map;
  const raw = JSON.parse(readFileSync(GROUND_TRUTH_PATH, "utf8")) as GroundTruth[];
  for (const row of raw) {
    map.set(row.file_base, row);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Scoring + failure classification
// ---------------------------------------------------------------------------

function scoreAgainstGolden(
  gt: GroundTruth,
  parsed: ResumeEval["parsed"],
  sections: string[],
  extractionOk: boolean,
  fileType: "pdf" | "docx"
): {
  scores: NonNullable<ResumeEval["scores"]>;
  failures: Failure[];
  assignmentStats: ResumeEval["assignmentStats"];
} {
  const failures: Failure[] = [];
  const scores = {
    name: fieldScore(gt.full_name, parsed.name),
    headline: fieldScore(gt.headline, parsed.headline, { optionalWhenExpectedEmpty: true }),
    location: fieldScore(gt.location, parsed.location, { optionalWhenExpectedEmpty: true }),
    currentCompany: fieldScore(gt.current_company, parsed.currentCompany),
    currentTitle: fieldScore(gt.designation, parsed.currentTitle),
    experiences: matchList(gt.employment, parsed.experiences, (e, a) => {
      const titleOk = softEqual(e.title, a.title);
      const companyOk = softEqual(e.company, a.company);
      return titleOk && companyOk;
    }),
    educations: matchList(gt.education, parsed.educations, (e, a) => {
      const instOk = softEqual(e.institution, a.institution);
      if (!instOk) return false;
      if (!e.degree) return true;
      return (
        !a.degree ||
        softEqual(e.degree, a.degree) ||
        norm(a.degree).includes(norm(e.degree).split(" ")[0] ?? "")
      );
    }),
    skills: { expected: 0, actual: 0, truePositive: 0, falsePositive: 0, falseNegative: 0 },
    projects: matchList(gt.projects, parsed.projects, (e, a) => softEqual(e.name, a.title)),
    certifications: matchList(
      gt.certifications,
      parsed.certificationsSample,
      (e, a) => softEqual(e, a) || norm(a).includes(norm(e).slice(0, 24))
    ),
  };

  let evaluatedAssignments = 0;
  let wrongAssignments = 0;
  let emptyFields = 0;
  let scoredFields = 0;

  const bumpField = (fs: FieldScore, code: FailureCode, severity: Severity, layer: Layer, label: string) => {
    scoredFields += 1;
    if (fs.expectedPresent) evaluatedAssignments += 1;
    if (fs.expectedPresent && !fs.actualPresent) {
      emptyFields += 1;
      failures.push({
        code: "FIELD_MISSING",
        layer,
        severity: severity === "P0" ? "P1" : severity, // missing is usually better than wrong
        evidence: `${label}: expected present, actual empty`,
      });
      return;
    }
    if (!fs.expectedPresent && fs.actualPresent) {
      evaluatedAssignments += 1;
      wrongAssignments += 1;
      failures.push({
        code: "FIELD_FALSE_POSITIVE",
        layer,
        severity,
        evidence: `${label}: unexpected value`,
      });
      return;
    }
    if (fs.expectedPresent && fs.actualPresent) {
      if (fs.correct) return;
      evaluatedAssignments += 1;
      wrongAssignments += 1;
      failures.push({ code, layer, severity, evidence: `${label}: mismatch` });
    }
  };

  bumpField(scores.name, "NAME_WRONG", "P0", "D", "name");
  bumpField(scores.headline, "HEADLINE_WRONG", "P0", "D", "headline");
  bumpField(scores.location, "LOCATION_WRONG", "P1", "D", "location");
  bumpField(scores.currentCompany, "CURRENT_COMPANY_WRONG", "P0", "D", "currentCompany");
  bumpField(scores.currentTitle, "CURRENT_TITLE_WRONG", "P0", "D", "currentTitle");

  // Cross-field: name leaked into headline
  if (
    parsed.headline &&
    parsed.name &&
    softEqual(parsed.headline, parsed.name)
  ) {
    wrongAssignments += 1;
    evaluatedAssignments += 1;
    failures.push({
      code: "NAME_WRONG",
      layer: "G",
      severity: "P0",
      evidence: "headline equals name",
    });
  }

  // Experience entity quality
  const expExpected = gt.employment.length;
  const expTp = scores.experiences.truePositive;
  const expFp = scores.experiences.falsePositive;
  const expFn = scores.experiences.falseNegative;
  evaluatedAssignments += expExpected + expFp;
  wrongAssignments += expFp; // false positives are wrong assignments
  // FN is empty/miss — track separately as missing, not wrong-field
  emptyFields += expFn;
  scoredFields += 1;

  if (expFp > 0 || expFn > 0) {
    failures.push({
      code: "EXPERIENCE_WRONG",
      layer: "D",
      severity: expFp > 0 ? "P0" : "P1",
      evidence: `exp tp=${expTp} fp=${expFp} fn=${expFn}`,
    });
  }

  // Project-as-experience detection
  for (const act of parsed.experiences) {
    const asProject = gt.projects.some(
      (p) => softEqual(p.name, act.company) || softEqual(p.name, act.title)
    );
    if (asProject) {
      wrongAssignments += 1;
      evaluatedAssignments += 1;
      failures.push({
        code: "PROJECT_AS_EXPERIENCE",
        layer: "D",
        severity: "P0",
        evidence: `${act.title} @ ${act.company}`,
      });
    }
    const asEdu = gt.education.some(
      (e) =>
        softEqual(e.institution, act.company) ||
        (e.degree && softEqual(e.degree, act.title))
    );
    if (asEdu) {
      wrongAssignments += 1;
      evaluatedAssignments += 1;
      failures.push({
        code: "EDUCATION_AS_EXPERIENCE",
        layer: "D",
        severity: "P0",
        evidence: `${act.title} @ ${act.company}`,
      });
    }
    // Company/title swapped vs any expected role
    const swapped = gt.employment.some(
      (e) => softEqual(e.title, act.company) && softEqual(e.company, act.title)
    );
    if (swapped) {
      wrongAssignments += 1;
      evaluatedAssignments += 1;
      failures.push({
        code: "COMPANY_TITLE_SWAPPED",
        layer: "E",
        severity: "P1",
        evidence: `${act.title} @ ${act.company}`,
      });
    }
  }

  // Experience leaked into projects
  for (const proj of parsed.projects) {
    const asExp = gt.employment.some(
      (e) => softEqual(e.company, proj.title) || softEqual(e.title, proj.title)
    );
    if (asExp) {
      wrongAssignments += 1;
      evaluatedAssignments += 1;
      failures.push({
        code: "EXPERIENCE_AS_PROJECT",
        layer: "D",
        severity: "P1",
        evidence: proj.title,
      });
    }
  }

  // Current role chronology
  if (
    scores.currentCompany.correct === false &&
    scores.currentCompany.actualPresent &&
    scores.currentCompany.expectedPresent
  ) {
    failures.push({
      code: "CURRENT_ROLE_WRONG",
      layer: "E",
      severity: "P0",
      evidence: "current company incorrect",
    });
  }

  // Education / projects / certs list quality
  const listBump = (
    ls: ListScore,
    wrongCode: FailureCode,
    severity: Severity
  ) => {
    evaluatedAssignments += ls.expected + ls.falsePositive;
    wrongAssignments += ls.falsePositive;
    emptyFields += ls.falseNegative;
    scoredFields += 1;
    if (ls.falsePositive > 0 || ls.falseNegative > 0) {
      failures.push({
        code: wrongCode,
        layer: "D",
        severity: ls.falsePositive > 0 ? severity : "P2",
        evidence: `tp=${ls.truePositive} fp=${ls.falsePositive} fn=${ls.falseNegative}`,
      });
    }
  };

  listBump(scores.educations, "EDUCATION_WRONG", "P1");
  listBump(scores.projects, "PROJECT_WRONG", "P1");
  listBump(scores.certifications, "CERTIFICATION_WRONG", "P2");

  // Section detection issues
  const needExp = gt.employment.length > 0;
  if (needExp && !sections.includes("experience") && parsed.experienceCount === 0) {
    failures.push({
      code: "SECTION_DETECTION",
      layer: "C",
      severity: "P1",
      evidence: "experience section not detected and no experiences parsed",
    });
  }
  if (gt.projects.length > 0 && !sections.includes("projects") && parsed.projectCount === 0) {
    failures.push({
      code: "SECTION_DETECTION",
      layer: "C",
      severity: "P1",
      evidence: "projects section not detected and no projects parsed",
    });
  }

  if (!extractionOk) {
    failures.push({
      code: "TEXT_EXTRACTION",
      layer: "A",
      severity: "P0",
      evidence: "extraction failed",
    });
  }

  // Heuristic: sidebar + many FPs on experience → reading order suspicion
  if (
    (gt.template_style === "sidebar" || fileType === "pdf") &&
    scores.experiences.falsePositive >= 2 &&
    scores.experiences.truePositive === 0
  ) {
    failures.push({
      code: "PDF_READING_ORDER",
      layer: "A",
      severity: "P0",
      evidence: "zero correct experiences with multiple false positives on likely layout-sensitive resume",
    });
  }

  // Deduplicate failure codes with same evidence
  const seen = new Set<string>();
  const unique = failures.filter((f) => {
    const k = `${f.code}::${f.evidence}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    scores,
    failures: unique,
    assignmentStats: {
      evaluatedAssignments,
      wrongAssignments,
      emptyFields,
      scoredFields,
    },
  };
}

function finalizeSkillsScore(
  gt: GroundTruth,
  actualSkills: string[],
  scores: NonNullable<ResumeEval["scores"]>,
  failures: Failure[],
  stats: ResumeEval["assignmentStats"]
): void {
  scores.skills = matchList(gt.skills_flat, actualSkills, (e, a) => skillEqual(e, a));
  const ls = scores.skills;
  stats.evaluatedAssignments += ls.expected + ls.falsePositive;
  stats.wrongAssignments += ls.falsePositive;
  stats.emptyFields += ls.falseNegative;
  stats.scoredFields += 1;
  if (ls.falsePositive > 0 || ls.falseNegative > 0) {
    failures.push({
      code: "SKILL_WRONG",
      layer: "D",
      severity: "P2",
      evidence: `tp=${ls.truePositive} fp=${ls.falsePositive} fn=${ls.falseNegative}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Evaluate one file
// ---------------------------------------------------------------------------

function parsedSnapshotFromDraft(draft: ParsedResumeDraft): ResumeEval["parsed"] {
  const mapped = mappedDraftFromParsed(draft);
  return {
    name: mapped.personal.fullName,
    headline: mapped.professional.headline,
    location: mapped.personal.location,
    currentCompany: mapped.professional.currentCompany,
    currentTitle: mapped.professional.currentTitle,
    experienceCount: mapped.experiences.length,
    educationCount: mapped.educations.length,
    skillCount: mapped.skills.length,
    projectCount: mapped.projects.length,
    certificationCount: mapped.certifications.length,
    experiences: mapped.experiences.map((e) => ({
      title: e.title,
      company: e.company,
      isCurrent: Boolean(e.isCurrent),
    })),
    educations: mapped.educations.map((e) => ({
      institution: e.institution,
      degree: e.degree ?? null,
    })),
    projects: mapped.projects.map((p) => ({ title: p.title })),
    skillsSample: mapped.skills.map((s) => s.name).slice(0, 40),
    certificationsSample: mapped.certifications.map((c) => c.name).slice(0, 20),
  };
}

function fieldCorrectnessDelta(
  det: NonNullable<ResumeEval["scores"]>,
  fin: NonNullable<ResumeEval["scores"]>
): { improved: number; regressed: number } {
  let improved = 0;
  let regressed = 0;
  const scalarKeys = [
    "name",
    "headline",
    "location",
    "currentCompany",
    "currentTitle",
  ] as const;
  for (const k of scalarKeys) {
    const a = det[k];
    const b = fin[k];
    if (!a || !b) continue;
    const aOk = a.expectedPresent ? a.correct === true : !a.actualPresent || a.correct !== false;
    const bOk = b.expectedPresent ? b.correct === true : !b.actualPresent || b.correct !== false;
    // Simpler: compare correct flag when expected present
    if (a.expectedPresent || b.expectedPresent) {
      const aGood = a.correct === true;
      const bGood = b.correct === true;
      if (!aGood && bGood) improved += 1;
      if (aGood && !bGood) regressed += 1;
    }
  }
  const listKeys = [
    "experiences",
    "educations",
    "skills",
    "projects",
    "certifications",
  ] as const;
  for (const k of listKeys) {
    const a = det[k];
    const b = fin[k];
    if (!a || !b) continue;
    const aNet = a.truePositive - a.falsePositive;
    const bNet = b.truePositive - b.falsePositive;
    if (bNet > aNet || (b.falsePositive < a.falsePositive && b.truePositive >= a.truePositive)) {
      improved += 1;
    } else if (
      bNet < aNet ||
      (b.falsePositive > a.falsePositive && b.truePositive <= a.truePositive)
    ) {
      regressed += 1;
    }
  }
  return { improved, regressed };
}

function classifyLlmImpact(input: {
  attempted: boolean;
  llmSuccess: boolean | null;
  assignmentDet?: ResumeEval["assignmentStats"];
  assignmentFinal?: ResumeEval["assignmentStats"];
  scoresDet?: ResumeEval["scores"];
  scoresFinal?: ResumeEval["scores"];
}): "useful" | "harmful" | "noop" | "n/a" | "failed" {
  if (!input.attempted) return "n/a";
  if (input.llmSuccess !== true) return "failed";
  if (!input.assignmentDet || !input.assignmentFinal || !input.scoresDet || !input.scoresFinal) {
    return "noop";
  }
  const wrongDelta =
    input.assignmentFinal.wrongAssignments - input.assignmentDet.wrongAssignments;
  const { improved, regressed } = fieldCorrectnessDelta(
    input.scoresDet,
    input.scoresFinal
  );
  const expDet = input.scoresDet.experiences;
  const expFin = input.scoresFinal.experiences;
  if (expFin && expDet && expFin.falsePositive > expDet.falsePositive) {
    return "harmful";
  }
  if (wrongDelta > 0 || regressed > improved) return "harmful";
  if (wrongDelta < 0 || improved > regressed) return "useful";
  if (wrongDelta === 0 && improved === 0 && regressed === 0) return "noop";
  if (improved > 0 && regressed === 0) return "useful";
  if (regressed > 0) return "harmful";
  return "noop";
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx] ?? null;
}

function latencyStats(values: number[]): {
  avg: number | null;
  p50: number | null;
  p95: number | null;
  max: number | null;
} {
  if (values.length === 0) {
    return { avg: null, p50: null, p95: null, max: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return {
    avg,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? null,
  };
}

async function evaluateFile(
  absPath: string,
  corpus: "benchmark-set" | "legacy",
  groundTruth: Map<string, GroundTruth>
): Promise<ResumeEval> {
  const file = basename(absPath);
  const stem = file.replace(/\.(pdf|docx)$/i, "");
  const type = file.toLowerCase().endsWith(".pdf") ? "pdf" : "docx";
  const gt = groundTruth.get(stem);

  const content = readFileSync(absPath);
  const extracted = await extractResumeText({
    content,
    fileName: file,
    mimeType: mimeFor(file),
  });

  if (!extracted.ok) {
    return {
      file,
      stem,
      type,
      corpus,
      layoutHints: layoutHintsFromStyle(gt?.template_style, gt?.parser_focus),
      validationStatus: gt ? "VALIDATED" : "UNVALIDATED_NEEDS_HUMAN_LABELING",
      extraction: {
        ok: false,
        textLength: 0,
        empty: true,
        errorCode: extracted.error.code,
        errorMessage: extracted.error.message,
      },
      sections: [],
      warnings: [extracted.error.message],
      parsed: {
        name: null,
        headline: null,
        location: null,
        currentCompany: null,
        currentTitle: null,
        experienceCount: 0,
        educationCount: 0,
        skillCount: 0,
        projectCount: 0,
        certificationCount: 0,
        experiences: [],
        educations: [],
        projects: [],
        skillsSample: [],
        certificationsSample: [],
      },
      failures: [
        {
          code: "TEXT_EXTRACTION",
          layer: "A",
          severity: "P0",
          evidence: extracted.error.message,
        },
      ],
      assignmentStats: {
        evaluatedAssignments: 0,
        wrongAssignments: 0,
        emptyFields: 0,
        scoredFields: 0,
      },
    };
  }

  const t0 = Date.now();
  const cleaned = cleanupResumeText(extracted.extraction.text);
  const sections = detectSections(cleaned);
  const { draft: rawDraft, warnings } = parseResumeFromCleanText(cleaned);
  const deterministicDraft = normalizeParsedResumeDraft(rawDraft);
  const deterministicMs = Date.now() - t0;

  const ambiguity = detectResumeAmbiguity({
    draft: deterministicDraft,
    cleanedText: cleaned,
    warnings,
  });

  const enablePhaseBLlm = process.env.PHASE_B_LLM === "1";
  const tLlm = Date.now();
  const semanticResult = await runSemanticVerificationPipeline({
    draft: deterministicDraft,
    cleanedText: cleaned,
    warnings,
    skipLlm: !enablePhaseBLlm,
  });
  const pipelineWallMs = Date.now() - tLlm;

  const finalDraft = semanticResult.draft;
  const mapped = mappedDraftFromParsed(finalDraft);
  const parsed = parsedSnapshotFromDraft(finalDraft);
  const parsedDeterministic = parsedSnapshotFromDraft(deterministicDraft);
  const totalMs = Date.now() - t0;
  const llmMs =
    semanticResult.meta.latencyMs ??
    (semanticResult.meta.attempted ? pipelineWallMs : null);

  const decisions = (semanticResult.meta.decisions ?? []).map(
    (d: SemanticVerificationDecision) => ({
      type: d.type,
      action: d.action,
      candidateId: d.candidateId,
      reason: d.reason.slice(0, 200),
      evidence: d.evidence.map((e) => e.slice(0, 120)),
      proposedSection: d.proposedSection,
    })
  );

  const base: ResumeEval = {
    file,
    stem,
    type,
    corpus,
    layoutHints: layoutHintsFromStyle(gt?.template_style, gt?.parser_focus),
    validationStatus: gt ? "VALIDATED" : "UNVALIDATED_NEEDS_HUMAN_LABELING",
    extraction: {
      ok: true,
      textLength: cleaned.length,
      empty: cleaned.length === 0,
    },
    sections,
    warnings: warnings.map(redactEmail),
    parsed,
    failures: [],
    assignmentStats: {
      evaluatedAssignments: 0,
      wrongAssignments: 0,
      emptyFields: 0,
      scoredFields: 0,
    },
    semantic: {
      needsVerification: ambiguity.needsVerification,
      reasons: ambiguity.reasons,
      attempted: semanticResult.meta.attempted,
      skipped: semanticResult.meta.skipped,
      skipReason: semanticResult.meta.skipReason,
      llmSuccess: semanticResult.meta.llmSuccess,
      llmError: semanticResult.meta.llmError
        ? semanticResult.meta.llmError.slice(0, 200)
        : null,
      decisionCount: semanticResult.meta.decisionCount,
      accepted: semanticResult.meta.accepted,
      rejected: semanticResult.meta.rejected,
      unsupported: semanticResult.meta.unsupported,
      fallbackDeterministic: semanticResult.meta.fallbackDeterministic,
      latencyMs: llmMs,
      retries: semanticResult.meta.retries,
      timedOut: semanticResult.meta.timedOut,
      usage: semanticResult.meta.usage,
      leaveEmptyCount: semanticResult.meta.leaveEmptyCount,
      reclassifyCount: semanticResult.meta.reclassifyCount,
      decisions,
      reconcileNotes: semanticResult.meta.reconcileNotes.slice(0, 40),
      impact: "n/a",
    },
    latency: {
      deterministicMs,
      llmMs,
      totalMs,
    },
  };

  if (!gt) {
    if (base.semantic) {
      base.semantic.impact = classifyLlmImpact({
        attempted: semanticResult.meta.attempted,
        llmSuccess: semanticResult.meta.llmSuccess,
      });
    }
    return base;
  }

  const scored = scoreAgainstGolden(gt, parsed, sections, true, type);
  finalizeSkillsScore(
    gt,
    mapped.skills.map((s) => s.name),
    scored.scores,
    scored.failures,
    scored.assignmentStats
  );
  parsed.skillsSample = mapped.skills.map((s) => s.name);

  const mappedDet = mappedDraftFromParsed(deterministicDraft);
  const scoredDet = scoreAgainstGolden(gt, parsedDeterministic, sections, true, type);
  finalizeSkillsScore(
    gt,
    mappedDet.skills.map((s) => s.name),
    scoredDet.scores,
    scoredDet.failures,
    scoredDet.assignmentStats
  );

  if (base.semantic) {
    base.semantic.impact = classifyLlmImpact({
      attempted: semanticResult.meta.attempted,
      llmSuccess: semanticResult.meta.llmSuccess,
      assignmentDet: scoredDet.assignmentStats,
      assignmentFinal: scored.assignmentStats,
      scoresDet: scoredDet.scores,
      scoresFinal: scored.scores,
    });
  }

  return {
    ...base,
    scores: scored.scores,
    failures: scored.failures,
    assignmentStats: scored.assignmentStats,
    scoresDeterministic: scoredDet.scores,
    assignmentStatsDeterministic: scoredDet.assignmentStats,
  };
}

// ---------------------------------------------------------------------------
// Review sheets (for unvalidated)
// ---------------------------------------------------------------------------

function writeReviewSheet(evalRow: ResumeEval): void {
  const lines = [
    `# Human review — ${evalRow.file}`,
    ``,
    `Status: ${evalRow.validationStatus}`,
    `Type: ${evalRow.type}`,
    `Corpus: ${evalRow.corpus}`,
    `Layout hints: ${evalRow.layoutHints.join(", ")}`,
    ``,
    `> Do NOT treat Actual as Expected. Fill Expected from the resume document.`,
    ``,
    `## Name`,
    `Expected: __________`,
    `Actual:   ${evalRow.parsed.name ?? "(empty)"}`,
    `Correct:  [ ]`,
    ``,
    `## Headline`,
    `Expected: __________`,
    `Actual:   ${evalRow.parsed.headline ?? "(empty)"}`,
    `Correct:  [ ]`,
    ``,
    `## Location`,
    `Expected: __________`,
    `Actual:   ${evalRow.parsed.location ?? "(empty)"}`,
    `Correct:  [ ]`,
    ``,
    `## Current company`,
    `Expected: __________`,
    `Actual:   ${evalRow.parsed.currentCompany ?? "(empty)"}`,
    `Correct:  [ ]`,
    ``,
    `## Current title`,
    `Expected: __________`,
    `Actual:   ${evalRow.parsed.currentTitle ?? "(empty)"}`,
    `Correct:  [ ]`,
    ``,
    `## Experience`,
    `Expected:`,
    `1. __________`,
    `2. __________`,
    ``,
    `Actual:`,
    ...evalRow.parsed.experiences.map(
      (e, i) => `${i + 1}. ${e.title} @ ${e.company}${e.isCurrent ? " (current)" : ""}`
    ),
    evalRow.parsed.experiences.length === 0 ? `(none)` : ``,
    `Correct: [ ]`,
    ``,
    `## Projects`,
    `Expected:`,
    `1. __________`,
    ``,
    `Actual:`,
    ...evalRow.parsed.projects.map((p, i) => `${i + 1}. ${p.title}`),
    evalRow.parsed.projects.length === 0 ? `(none)` : ``,
    `Correct: [ ]`,
    ``,
    `## Education`,
    `Actual:`,
    ...evalRow.parsed.educations.map(
      (e, i) => `${i + 1}. ${e.degree ?? "?"} @ ${e.institution}`
    ),
    `Correct: [ ]`,
    ``,
    `## Skills (sample)`,
    `Actual: ${evalRow.parsed.skillsSample.slice(0, 15).join(", ") || "(none)"}`,
    `Correct: [ ]`,
    ``,
    `## Diagnostics`,
    `Sections: ${evalRow.sections.join(", ") || "(none)"}`,
    `Text length: ${evalRow.extraction.textLength}`,
    `Warnings: ${evalRow.warnings.join(" | ") || "(none)"}`,
    ``,
  ];
  writeFileSync(join(REVIEW_DIR, `${evalRow.stem}.review.md`), lines.join("\n"), "utf8");
}

// ---------------------------------------------------------------------------
// Aggregate report
// ---------------------------------------------------------------------------

function aggregate(results: ResumeEval[]) {
  const validated = results.filter((r) => r.validationStatus === "VALIDATED");
  const pdfs = results.filter((r) => r.type === "pdf");
  const docxs = results.filter((r) => r.type === "docx");

  const extractionSuccess = (rows: ResumeEval[]) =>
    rows.length === 0
      ? null
      : rows.filter((r) => r.extraction.ok && !r.extraction.empty).length / rows.length;

  const avgLen = (rows: ResumeEval[]) => {
    const ok = rows.filter((r) => r.extraction.ok);
    if (!ok.length) return 0;
    return ok.reduce((s, r) => s + r.extraction.textLength, 0) / ok.length;
  };

  type Acc = { tp: number; fp: number; fn: number; correctFields: number; presentExpected: number };
  const fieldAcc = (): Acc => ({
    tp: 0,
    fp: 0,
    fn: 0,
    correctFields: 0,
    presentExpected: 0,
  });

  const scalar = {
    name: fieldAcc(),
    headline: fieldAcc(),
    location: fieldAcc(),
    currentCompany: fieldAcc(),
    currentTitle: fieldAcc(),
  };

  const lists = {
    experiences: fieldAcc(),
    educations: fieldAcc(),
    skills: fieldAcc(),
    projects: fieldAcc(),
    certifications: fieldAcc(),
  };

  const addField = (acc: Acc, fs: FieldScore | undefined) => {
    if (!fs) return;
    if (fs.expectedPresent) acc.presentExpected += 1;
    if (fs.expectedPresent && fs.actualPresent && fs.correct) {
      acc.tp += 1;
      acc.correctFields += 1;
    } else if (fs.expectedPresent && fs.actualPresent && !fs.correct) {
      acc.fp += 1; // wrong value counts against precision
    } else if (fs.expectedPresent && !fs.actualPresent) {
      acc.fn += 1;
    } else if (!fs.expectedPresent && fs.actualPresent) {
      acc.fp += 1;
    }
  };

  const addList = (acc: Acc, ls: ListScore | undefined) => {
    if (!ls) return;
    acc.tp += ls.truePositive;
    acc.fp += ls.falsePositive;
    acc.fn += ls.falseNegative;
  };

  let wrongAssignments = 0;
  let evaluatedAssignments = 0;
  let emptyFields = 0;

  const severityCounts = { P0: 0, P1: 0, P2: 0 };
  const layerCounts: Record<Layer, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    G: 0,
    H: 0,
  };
  const codeCounts = new Map<string, number>();

  for (const r of validated) {
    wrongAssignments += r.assignmentStats.wrongAssignments;
    evaluatedAssignments += r.assignmentStats.evaluatedAssignments;
    emptyFields += r.assignmentStats.emptyFields;
    if (r.scores) {
      addField(scalar.name, r.scores.name);
      addField(scalar.headline, r.scores.headline);
      addField(scalar.location, r.scores.location);
      addField(scalar.currentCompany, r.scores.currentCompany);
      addField(scalar.currentTitle, r.scores.currentTitle);
      addList(lists.experiences, r.scores.experiences);
      addList(lists.educations, r.scores.educations);
      addList(lists.skills, r.scores.skills);
      addList(lists.projects, r.scores.projects);
      addList(lists.certifications, r.scores.certifications);
    }
    for (const f of r.failures) {
      severityCounts[f.severity] += 1;
      layerCounts[f.layer] += 1;
      codeCounts.set(f.code, (codeCounts.get(f.code) ?? 0) + 1);
    }
  }

  const metric = (acc: Acc) => ({
    precision: precision(acc.tp, acc.fp),
    recall: recall(acc.tp, acc.fn),
    tp: acc.tp,
    fp: acc.fp,
    fn: acc.fn,
  });

  const failureMatrix = validated
    .flatMap((r) =>
      r.failures
        .filter((f) => f.severity === "P0" || f.severity === "P1")
        .map((f) => ({
          resume: r.file,
          stem: r.stem,
          type: r.type,
          template: groundTruthStyle(r.stem),
          failure: f.code,
          layer: f.layer,
          severity: f.severity,
          evidence: f.evidence,
        }))
    )
    .sort((a, b) => a.severity.localeCompare(b.severity) || a.resume.localeCompare(b.resume));

  const worst = [...validated]
    .map((r) => ({
      file: r.file,
      type: r.type,
      p0: r.failures.filter((f) => f.severity === "P0").length,
      p1: r.failures.filter((f) => f.severity === "P1").length,
      wrong: r.assignmentStats.wrongAssignments,
      empty: r.assignmentStats.emptyFields,
      layout: r.layoutHints.join("|"),
    }))
    .sort((a, b) => b.p0 - a.p0 || b.wrong - a.wrong || b.p1 - a.p1)
    .slice(0, 5);

  // Phase B / ambiguity observability
  const withSemantic = results.filter((r) => r.semantic);
  const needsVerify = withSemantic.filter((r) => r.semantic?.needsVerification).length;
  const llmAttempted = withSemantic.filter((r) => r.semantic?.attempted).length;
  const llmSuccess = withSemantic.filter((r) => r.semantic?.llmSuccess === true).length;
  const llmFail = withSemantic.filter((r) => r.semantic?.llmSuccess === false).length;
  const llmAccepted = withSemantic.reduce((s, r) => s + (r.semantic?.accepted ?? 0), 0);
  const llmRejected = withSemantic.reduce((s, r) => s + (r.semantic?.rejected ?? 0), 0);
  const llmUnsupported = withSemantic.reduce(
    (s, r) => s + (r.semantic?.unsupported ?? 0),
    0
  );

  let detWrong = 0;
  let detEval = 0;
  const detLists = {
    experiences: fieldAcc(),
    educations: fieldAcc(),
    projects: fieldAcc(),
  };
  for (const r of validated) {
    if (r.assignmentStatsDeterministic) {
      detWrong += r.assignmentStatsDeterministic.wrongAssignments;
      detEval += r.assignmentStatsDeterministic.evaluatedAssignments;
    }
    if (r.scoresDeterministic) {
      addList(detLists.experiences, r.scoresDeterministic.experiences);
      addList(detLists.educations, r.scoresDeterministic.educations);
      addList(detLists.projects, r.scoresDeterministic.projects);
    }
  }

  return {
    corpus: {
      totalFiles: results.length,
      uniqueStems: new Set(results.map((r) => r.stem)).size,
      pdfs: pdfs.length,
      docxs: docxs.length,
      validatedFiles: validated.length,
      unvalidatedFiles: results.length - validated.length,
      benchmarkSetFiles: results.filter((r) => r.corpus === "benchmark-set").length,
      legacyFiles: results.filter((r) => r.corpus === "legacy").length,
    },
    extraction: {
      pdfSuccessRate: extractionSuccess(pdfs),
      docxSuccessRate: extractionSuccess(docxs),
      emptyRate:
        results.length === 0
          ? null
          : results.filter((r) => r.extraction.empty).length / results.length,
      avgTextLength: avgLen(results),
      avgTextLengthPdf: avgLen(pdfs),
      avgTextLengthDocx: avgLen(docxs),
    },
    fieldMetrics: {
      name: metric(scalar.name),
      headline: metric(scalar.headline),
      location: metric(scalar.location),
      currentCompany: metric(scalar.currentCompany),
      currentTitle: metric(scalar.currentTitle),
      experiences: metric(lists.experiences),
      educations: metric(lists.educations),
      skills: metric(lists.skills),
      projects: metric(lists.projects),
      certifications: metric(lists.certifications),
    },
    rates: {
      wrongFieldAssignmentRate:
        evaluatedAssignments === 0 ? null : wrongAssignments / evaluatedAssignments,
      falsePositiveRate:
        evaluatedAssignments === 0 ? null : wrongAssignments / evaluatedAssignments,
      emptyFieldRate:
        evaluatedAssignments === 0
          ? null
          : emptyFields / Math.max(1, evaluatedAssignments + emptyFields),
      evaluatedAssignments,
      wrongAssignments,
      emptyFields,
    },
    phaseB: {
      phaseBLlmEnabled: process.env.PHASE_B_LLM === "1",
      totalResumes: withSemantic.length,
      deterministicOnlyResumes: withSemantic.length - needsVerify,
      llmCandidateResumes: needsVerify,
      ambiguityInvocationRate:
        withSemantic.length === 0 ? null : needsVerify / withSemantic.length,
      llmAttempted,
      llmSuccess,
      llmFailures: llmFail,
      llmAcceptedDecisions: llmAccepted,
      llmRejectedDecisions: llmRejected,
      llmUnsupportedDecisions: llmUnsupported,
      leaveEmptyDecisions: withSemantic.reduce(
        (s, r) => s + (r.semantic?.leaveEmptyCount ?? 0),
        0
      ),
      reclassifyDecisions: withSemantic.reduce(
        (s, r) => s + (r.semantic?.reclassifyCount ?? 0),
        0
      ),
      timeouts: withSemantic.filter((r) => r.semantic?.timedOut).length,
      retries: withSemantic.reduce((s, r) => s + (r.semantic?.retries ?? 0), 0),
      usefulCorrections: withSemantic.filter((r) => r.semantic?.impact === "useful")
        .length,
      harmfulCorrections: withSemantic.filter((r) => r.semantic?.impact === "harmful")
        .length,
      noopVerifications: withSemantic.filter((r) => r.semantic?.impact === "noop")
        .length,
      failedVerifications: withSemantic.filter((r) => r.semantic?.impact === "failed")
        .length,
      wrongFieldRateDeterministic: detEval === 0 ? null : detWrong / detEval,
      wrongFieldRateAfterReconcile:
        evaluatedAssignments === 0 ? null : wrongAssignments / evaluatedAssignments,
      experiencePrecisionDeterministic: precision(
        detLists.experiences.tp,
        detLists.experiences.fp
      ),
      experiencePrecisionAfter: metric(lists.experiences).precision,
      projectPrecisionDeterministic: precision(
        detLists.projects.tp,
        detLists.projects.fp
      ),
      projectPrecisionAfter: metric(lists.projects).precision,
      educationPrecisionDeterministic: precision(
        detLists.educations.tp,
        detLists.educations.fp
      ),
      educationPrecisionAfter: metric(lists.educations).precision,
      tokenUsage: (() => {
        const usages = withSemantic
          .map((r) => r.semantic?.usage)
          .filter((u): u is NonNullable<typeof u> => Boolean(u));
        if (usages.length === 0) {
          return {
            available: false as const,
            note: "token usage unavailable from current provider integration or no successful calls",
          };
        }
        const avg = (pick: "inputTokens" | "outputTokens" | "totalTokens") => {
          const nums = usages
            .map((u) => u[pick])
            .filter((n): n is number => typeof n === "number");
          if (nums.length === 0) return null;
          return nums.reduce((a, b) => a + b, 0) / nums.length;
        };
        const useful = withSemantic.filter((r) => r.semantic?.impact === "useful");
        const usefulTokens = useful
          .map((r) => r.semantic?.usage?.totalTokens)
          .filter((n): n is number => typeof n === "number");
        return {
          available: true as const,
          samples: usages.length,
          averageInputTokens: avg("inputTokens"),
          averageOutputTokens: avg("outputTokens"),
          averageTotalTokens: avg("totalTokens"),
          tokensPerUsefulCorrection:
            usefulTokens.length === 0
              ? null
              : usefulTokens.reduce((a, b) => a + b, 0) /
                Math.max(1, useful.length),
        };
      })(),
      latency: {
        deterministic: latencyStats(
          results
            .map((r) => r.latency?.deterministicMs)
            .filter((n): n is number => typeof n === "number")
        ),
        llm: latencyStats(
          results
            .map((r) => r.latency?.llmMs)
            .filter((n): n is number => typeof n === "number")
        ),
        total: latencyStats(
          results
            .map((r) => r.latency?.totalMs)
            .filter((n): n is number => typeof n === "number")
        ),
        llmVerifiedOnly: latencyStats(
          results
            .filter((r) => r.semantic?.attempted)
            .map((r) => r.latency?.totalMs)
            .filter((n): n is number => typeof n === "number")
        ),
        deterministicOnly: latencyStats(
          results
            .filter((r) => !r.semantic?.attempted)
            .map((r) => r.latency?.totalMs)
            .filter((n): n is number => typeof n === "number")
        ),
      },
    },
    severityCounts,
    layerCounts,
    codeCounts: Object.fromEntries([...codeCounts.entries()].sort((a, b) => b[1] - a[1])),
    failureMatrix,
    worst5: worst,
  };
}

const styleByStem = new Map<string, string>();

function groundTruthStyle(stem: string): string {
  return styleByStem.get(stem) ?? "?";
}

function renderMarkdownReport(
  summary: ReturnType<typeof aggregate>,
  results: ResumeEval[]
): string {
  const fm = summary.fieldMetrics;
  const lines: string[] = [];
  lines.push(`# RESUME CORPUS BENCHMARK`);
  lines.push(``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`## Validation status`);
  lines.push(``);
  lines.push(`- Benchmark-set with \`ground-truth.json\`: **VALIDATED** metrics below.`);
  lines.push(
    `- Legacy resume-01..05 without golden labels: **UNVALIDATED / NEEDS HUMAN LABELING** (review sheets generated; excluded from precision/recall).`
  );
  lines.push(``);
  lines.push(`## Corpus discovered`);
  lines.push(``);
  lines.push(`| Item | Count |`);
  lines.push(`| ---- | ----: |`);
  lines.push(`| Total files evaluated | ${summary.corpus.totalFiles} |`);
  lines.push(`| Unique resume stems | ${summary.corpus.uniqueStems} |`);
  lines.push(`| PDFs | ${summary.corpus.pdfs} |`);
  lines.push(`| DOCX | ${summary.corpus.docxs} |`);
  lines.push(`| Validated (ground truth) | ${summary.corpus.validatedFiles} |`);
  lines.push(`| Unvalidated (needs labeling) | ${summary.corpus.unvalidatedFiles} |`);
  lines.push(`| benchmark-set files | ${summary.corpus.benchmarkSetFiles} |`);
  lines.push(`| legacy root files | ${summary.corpus.legacyFiles} |`);
  lines.push(``);
  lines.push(`## Extraction`);
  lines.push(``);
  lines.push(`| Metric | Result |`);
  lines.push(`| ------ | -----: |`);
  lines.push(`| PDF extraction success | ${pct(summary.extraction.pdfSuccessRate)} |`);
  lines.push(`| DOCX extraction success | ${pct(summary.extraction.docxSuccessRate)} |`);
  lines.push(`| Empty extraction rate | ${pct(summary.extraction.emptyRate)} |`);
  lines.push(`| Avg text length (all) | ${Math.round(summary.extraction.avgTextLength)} |`);
  lines.push(`| Avg text length (PDF) | ${Math.round(summary.extraction.avgTextLengthPdf)} |`);
  lines.push(`| Avg text length (DOCX) | ${Math.round(summary.extraction.avgTextLengthDocx)} |`);
  lines.push(``);
  lines.push(`## Field metrics (VALIDATED only)`);
  lines.push(``);
  lines.push(`| Field | Precision | Recall | TP | FP | FN |`);
  lines.push(`| ----- | --------: | -----: | -: | -: | -: |`);
  for (const [name, m] of Object.entries(fm)) {
    lines.push(
      `| ${name} | ${pct(m.precision)} | ${pct(m.recall)} | ${m.tp} | ${m.fp} | ${m.fn} |`
    );
  }
  lines.push(``);
  lines.push(`## Critical rates (VALIDATED only)`);
  lines.push(``);
  lines.push(`| Metric | Result |`);
  lines.push(`| ------ | -----: |`);
  lines.push(`| Wrong-field assignment rate | ${pct(summary.rates.wrongFieldAssignmentRate)} |`);
  lines.push(`| Empty-field rate | ${pct(summary.rates.emptyFieldRate)} |`);
  lines.push(`| Evaluated assignments | ${summary.rates.evaluatedAssignments} |`);
  lines.push(`| Wrong assignments | ${summary.rates.wrongAssignments} |`);
  lines.push(`| Empty / missed expected | ${summary.rates.emptyFields} |`);
  lines.push(`| P0 failure events | ${summary.severityCounts.P0} |`);
  lines.push(`| P1 failure events | ${summary.severityCounts.P1} |`);
  lines.push(`| P2 failure events | ${summary.severityCounts.P2} |`);
  lines.push(``);
  lines.push(`## Phase B — selective LLM`);
  lines.push(``);
  lines.push(`| Metric | Result |`);
  lines.push(`| ------ | -----: |`);
  lines.push(`| PHASE_B_LLM enabled | ${summary.phaseB.phaseBLlmEnabled ? "yes" : "no"} |`);
  lines.push(`| Total resumes (with semantic meta) | ${summary.phaseB.totalResumes} |`);
  lines.push(`| Deterministic-only (no ambiguity) | ${summary.phaseB.deterministicOnlyResumes} |`);
  lines.push(`| Ambiguous (LLM candidates) | ${summary.phaseB.llmCandidateResumes} |`);
  lines.push(`| Ambiguity / LLM invocation rate | ${pct(summary.phaseB.ambiguityInvocationRate)} |`);
  lines.push(`| LLM attempted | ${summary.phaseB.llmAttempted} |`);
  lines.push(`| LLM success | ${summary.phaseB.llmSuccess} |`);
  lines.push(`| LLM failures | ${summary.phaseB.llmFailures} |`);
  lines.push(`| LLM accepted decisions | ${summary.phaseB.llmAcceptedDecisions} |`);
  lines.push(`| LLM rejected decisions | ${summary.phaseB.llmRejectedDecisions} |`);
  lines.push(`| LLM unsupported decisions | ${summary.phaseB.llmUnsupportedDecisions} |`);
  lines.push(
    `| Wrong-field rate (deterministic A+) | ${pct(summary.phaseB.wrongFieldRateDeterministic)} |`
  );
  lines.push(
    `| Wrong-field rate (after reconcile) | ${pct(summary.phaseB.wrongFieldRateAfterReconcile)} |`
  );
  lines.push(
    `| Experience precision A+ → after | ${pct(summary.phaseB.experiencePrecisionDeterministic)} → ${pct(summary.phaseB.experiencePrecisionAfter)} |`
  );
  lines.push(
    `| Project precision A+ → after | ${pct(summary.phaseB.projectPrecisionDeterministic)} → ${pct(summary.phaseB.projectPrecisionAfter)} |`
  );
  lines.push(
    `| Education precision A+ → after | ${pct(summary.phaseB.educationPrecisionDeterministic)} → ${pct(summary.phaseB.educationPrecisionAfter)} |`
  );
  lines.push(``);
  lines.push(`## Root-cause layers (failure events)`);
  lines.push(``);
  lines.push(`| Layer | Meaning | Count |`);
  lines.push(`| ----- | ------- | ----: |`);
  lines.push(`| A | PDF/DOCX extraction | ${summary.layerCounts.A} |`);
  lines.push(`| B | text normalization | ${summary.layerCounts.B} |`);
  lines.push(`| C | section detection | ${summary.layerCounts.C} |`);
  lines.push(`| D | field extraction | ${summary.layerCounts.D} |`);
  lines.push(`| E | entity association | ${summary.layerCounts.E} |`);
  lines.push(`| F | normalization | ${summary.layerCounts.F} |`);
  lines.push(`| G | draft mapping | ${summary.layerCounts.G} |`);
  lines.push(`| H | merge | ${summary.layerCounts.H} |`);
  lines.push(``);
  lines.push(`## Failure code frequency`);
  lines.push(``);
  lines.push(`| Code | Count |`);
  lines.push(`| ---- | ----: |`);
  for (const [code, n] of Object.entries(summary.codeCounts)) {
    lines.push(`| ${code} | ${n} |`);
  }
  lines.push(``);
  lines.push(`## Failure matrix (P0/P1)`);
  lines.push(``);
  lines.push(`| Resume | Type | Template | Failure | Layer | Severity | Evidence |`);
  lines.push(`| ------ | ---- | -------- | ------- | ----- | -------- | -------- |`);
  for (const row of summary.failureMatrix.slice(0, 80)) {
    lines.push(
      `| ${row.stem} | ${row.type} | ${row.template} | ${row.failure} | ${row.layer} | ${row.severity} | ${row.evidence.replace(/\|/g, "/")} |`
    );
  }
  if (summary.failureMatrix.length > 80) {
    lines.push(`| … | … | … | … | … | … | (+${summary.failureMatrix.length - 80} more in JSON) |`);
  }
  lines.push(``);
  lines.push(`## Worst 5 resumes (by P0 then wrong assignments)`);
  lines.push(``);
  lines.push(`| File | Type | P0 | P1 | Wrong | Empty | Layout |`);
  lines.push(`| ---- | ---- | -: | -: | ----: | ----: | ------ |`);
  for (const w of summary.worst5) {
    lines.push(
      `| ${w.file} | ${w.type} | ${w.p0} | ${w.p1} | ${w.wrong} | ${w.empty} | ${w.layout} |`
    );
  }
  lines.push(``);
  lines.push(`## Unvalidated files`);
  lines.push(``);
  for (const r of results.filter((x) => x.validationStatus !== "VALIDATED")) {
    lines.push(`- ${r.file} → \`human-review/${r.stem}.review.md\``);
  }
  lines.push(``);
  return lines.join("\n");
}

function decideRecommendation(summary: ReturnType<typeof aggregate>): {
  option: "A" | "B" | "C" | "D" | "E";
  title: string;
  rationale: string[];
  llmNeedEstimate: string;
} {
  const layerA = summary.layerCounts.A;
  const layerD = summary.layerCounts.D;
  const layerE = summary.layerCounts.E;
  const layerC = summary.layerCounts.C;
  const p0 = summary.severityCounts.P0;
  const wrongRate = summary.rates.wrongFieldAssignmentRate ?? 0;
  const totalLayer =
    Object.values(summary.layerCounts).reduce((a, b) => a + b, 0) || 1;
  const extractionShare = layerA / totalLayer;
  const semanticShare = (layerD + layerE) / totalLayer;
  const experienceFp = summary.fieldMetrics.experiences.fp;
  const projectAsExp = summary.codeCounts["PROJECT_AS_EXPERIENCE"] ?? 0;
  const nameWrong = summary.codeCounts["NAME_WRONG"] ?? 0;
  const sectionIssues = summary.codeCounts["SECTION_DETECTION"] ?? 0;
  const fieldMissing = summary.codeCounts["FIELD_MISSING"] ?? 0;

  // Empty extraction / true layer-A dominance → PDF/OCR path.
  if (extractionShare >= 0.35 || (summary.extraction.emptyRate ?? 0) > 0.1) {
    if ((summary.extraction.emptyRate ?? 0) > 0.15) {
      return {
        option: "E",
        title: "OCR FALLBACK JUSTIFIED",
        rationale: [
          `Empty extraction rate ${pct(summary.extraction.emptyRate)} suggests scanned/image PDFs.`,
        ],
        llmNeedEstimate: "OCR first; LLM only after text is recoverable.",
      };
    }
    return {
      option: "C",
      title: "IMPROVE PDF EXTRACTION FIRST",
      rationale: [
        `Layer A share of failure events: ${pct(extractionShare)}.`,
        `Extraction/layout is the primary bottleneck.`,
      ],
      llmNeedEstimate:
        "Defer LLM until extraction/layout failures drop; likely <15% need semantic help after layout fixes.",
    };
  }

  // Phase B live decision (when Gemini was enabled)
  const phaseB = summary.phaseB;
  const expFp = summary.fieldMetrics.experiences.fp;
  const projectAsExpB = summary.codeCounts["PROJECT_AS_EXPERIENCE"] ?? 0;
  const invRate = phaseB.ambiguityInvocationRate ?? 0;
  const wrongAfter = phaseB.wrongFieldRateAfterReconcile ?? wrongRate;
  const wrongBefore = phaseB.wrongFieldRateDeterministic ?? wrongRate;
  const expPrec = summary.fieldMetrics.experiences.precision ?? 0;

  if (expPrec < 1 || expFp > 0 || projectAsExpB > 0 || p0 > 0) {
    if (phaseB.phaseBLlmEnabled && (phaseB.llmSuccess > 0 || phaseB.llmAttempted > 0)) {
      return {
        option: "B",
        title: "ROLLBACK",
        rationale: [
          `Safety gate failed: experience P=${pct(expPrec)} FP=${expFp}, PROJECT_AS_EXPERIENCE=${projectAsExpB}, P0=${p0}.`,
        ],
        llmNeedEstimate: "Disable LLM path until safety is restored.",
      };
    }
  }

  if (
    expFp === 0 &&
    projectAsExpB === 0 &&
    p0 === 0 &&
    wrongAfter <= 0.05 &&
    expPrec >= 0.999
  ) {
    if (phaseB.phaseBLlmEnabled) {
      const useful = phaseB.usefulCorrections ?? 0;
      const harmful = phaseB.harmfulCorrections ?? 0;
      const noop = phaseB.noopVerifications ?? 0;
      const attempted = phaseB.llmAttempted || 1;
      if (phaseB.llmFailures > 0 && phaseB.llmSuccess === 0) {
        return {
          option: "B",
          title: "NEEDS PHASE B+",
          rationale: [
            `LLM invocations failed (${phaseB.llmFailures}); drafts fell back to deterministic A+.`,
            `Fix Gemini configuration before claiming Phase B accuracy gains.`,
          ],
          llmNeedEstimate: "Provider failures — verify GEMINI_API_KEY / model access.",
        };
      }
      if (harmful > 0) {
        return {
          option: "B",
          title: "DETERMINISTIC ONLY",
          rationale: [
            `Harmful corrections detected (${harmful}). Safety held, but LLM degraded some files.`,
            `Useful=${useful} no-op=${noop} harmful=${harmful}.`,
          ],
          llmNeedEstimate: "Prefer deterministic-only until harmful rate is ~0.",
        };
      }
      if (
        useful > 0 &&
        wrongAfter < wrongBefore - 0.001 &&
        harmful === 0 &&
        invRate <= 0.35
      ) {
        return {
          option: "B",
          title: "READY FOR STAGING",
          rationale: [
            `Useful corrections=${useful}; harmful=0; wrong-field ${pct(wrongBefore)} → ${pct(wrongAfter)}.`,
            `Invocation rate ${pct(invRate)}.`,
          ],
          llmNeedEstimate: `Selective verification adds value; rate ${pct(invRate)}.`,
        };
      }
      if (useful === 0 && phaseB.llmSuccess > 0) {
        return {
          option: "B",
          title: "DETERMINISTIC ONLY",
          rationale: [
            `Gemini ran (${phaseB.llmSuccess} success) but produced no useful corrections (no-op=${noop}).`,
            `Wrong-field unchanged at ${pct(wrongAfter)}. Cost/latency not justified.`,
          ],
          llmNeedEstimate: "Keep ambiguity gate code; default skip LLM in production until prompt/reconcile improves.",
        };
      }
      return {
        option: "B",
        title: "NEEDS PHASE B+",
        rationale: [
          `Safety preserved; wrong-field ${pct(wrongBefore)} → ${pct(wrongAfter)}.`,
          `Useful=${useful} no-op=${noop} harmful=${harmful}; success=${phaseB.llmSuccess} fail=${phaseB.llmFailures}.`,
          `Ambiguity rate ${pct(invRate)}.`,
        ],
        llmNeedEstimate: `Invocation rate ${pct(useful / attempted)}. Tune prompt/gate before staging.`,
      };
    }
    if (!phaseB.phaseBLlmEnabled) {
      return {
        option: "B",
        title: "NEEDS PHASE B+",
        rationale: [
          `A+ safety intact (experience FP=0, P0=0, wrong-field ${pct(wrongRate)}).`,
          `Ambiguity gate would invoke LLM on ${pct(invRate)} of resumes.`,
          `Re-run with PHASE_B_LLM=1 and a valid GEMINI_API_KEY to measure LLM correction value.`,
        ],
        llmNeedEstimate: `Ambiguity rate ${pct(invRate)}; enable PHASE_B_LLM=1 for live Gemini metrics.`,
      };
    }
  }

  // Phase A precision goal: experience false positives / project-as-experience must stay near zero.
  // Remaining systematic name/section issues on messy+sidebar templates → more deterministic work.
  if (
    experienceFp > 5 ||
    projectAsExp > 0 ||
    nameWrong >= 6 ||
    sectionIssues >= 15 ||
    wrongRate > 0.12
  ) {
    return {
      option: "A",
      title: "PHASE A+ REQUIRED",
      rationale: [
        `Experience FP=${experienceFp}, PROJECT_AS_EXPERIENCE=${projectAsExp} (Phase A precision core).`,
        `Systematic gaps remain: NAME_WRONG=${nameWrong}, SECTION_DETECTION=${sectionIssues}, FIELD_MISSING=${fieldMissing}.`,
        `Dominant layer D=${layerD} (field extraction), C=${layerC} (sections). Wrong-field rate ${pct(wrongRate)}.`,
        `Prefer deterministic fixes for sidebar/table name headers and custom section aliases before LLM.`,
      ],
      llmNeedEstimate:
        "Not primary yet. After A+, expect roughly 10–20% of resumes to need selective verification (sidebar/messy/ambiguous only).",
    };
  }

  if (wrongRate <= 0.08 && p0 <= 12 && semanticShare >= 0.4) {
    return {
      option: "B",
      title: "PROCEED TO PHASE B",
      rationale: [
        `Low wrong-field rate (${pct(wrongRate)}) with manageable P0 count (${p0}).`,
        `Next: ambiguity detection + reconciliation without full-pipeline LLM.`,
      ],
      llmNeedEstimate:
        "Likely 10–20% of resumes for selective assist after ambiguity gating.",
    };
  }

  if (semanticShare >= 0.45 && wrongRate <= 0.1 && experienceFp === 0) {
    return {
      option: "D",
      title: "SELECTIVE LLM VERIFICATION JUSTIFIED",
      rationale: [
        `Deterministic core is strong on employment precision (experience FP=${experienceFp}).`,
        `Remaining errors skew semantic (D+E share ${pct(semanticShare)}).`,
        `Use LLM only on ambiguity flags, not all resumes.`,
      ],
      llmNeedEstimate:
        "Order-of-magnitude: ~15–25% of resumes may need selective verification.",
    };
  }

  return {
    option: "A",
    title: "PHASE A+ REQUIRED",
    rationale: [
      `Continue deterministic precision/recall tightening.`,
      `Wrong-field ${pct(wrongRate)}; P0=${p0}; D=${layerD} E=${layerE} A=${layerA}.`,
    ],
    llmNeedEstimate:
      "Hold broad LLM until wrong-field rate is clearly <8% and sidebar name P0s are gone.",
  };
}

function writePhaseBLiveArtifacts(input: {
  summary: ReturnType<typeof aggregate>;
  results: ResumeEval[];
  recommendation: ReturnType<typeof decideRecommendation>;
  payload: unknown;
}): void {
  const { summary, results, recommendation } = input;
  const pb = summary.phaseB;
  const fm = summary.fieldMetrics;
  const ms = (n: number | null | undefined) =>
    n == null ? "n/a" : `${Math.round(n)}ms`;

  const ambiguous = results.filter((r) => r.semantic?.needsVerification);
  const attempted = results.filter((r) => r.semantic?.attempted);
  const focusStems = ["b02", "b11", "b12", "b23", "b28"];

  const hallucinationFlags: Array<{
    file: string;
    note: string;
    decision: unknown;
  }> = [];
  for (const r of attempted) {
    for (const note of r.semantic?.reconcileNotes ?? []) {
      if (note.startsWith("unsupported:") || note.includes("HALLUCINATION")) {
        hallucinationFlags.push({
          file: r.file,
          note,
          decision: null,
        });
      }
    }
    // Accepted decisions whose evidence was rejected as unsupported are already in notes.
    // Flag if accepted > 0 but reconcile notes mention unsupported for same run with
    // decisions that passed — double-check: any accept with empty evidence shouldn't exist (Zod).
  }

  const perFile = results.map((r) => ({
    resume: r.file,
    stem: r.stem,
    format: r.type,
    validated: r.validationStatus === "VALIDATED",
    ambiguityDetected: Boolean(r.semantic?.needsVerification),
    ambiguityReasons: r.semantic?.reasons ?? [],
    llmInvoked: Boolean(r.semantic?.attempted),
    llmSucceeded: r.semantic?.llmSuccess === true,
    llmFailed: r.semantic?.llmSuccess === false,
    llmTimeout: Boolean(r.semantic?.timedOut),
    llmRetries: r.semantic?.retries ?? 0,
    decisionCount: r.semantic?.decisionCount ?? 0,
    acceptedDecisions: r.semantic?.accepted ?? 0,
    rejectedDecisions: r.semantic?.rejected ?? 0,
    unsupportedDecisions: r.semantic?.unsupported ?? 0,
    leaveEmptyDecisions: r.semantic?.leaveEmptyCount ?? 0,
    reclassifyDecisions: r.semantic?.reclassifyCount ?? 0,
    impact: r.semantic?.impact ?? "n/a",
    wrongAssignmentsDeterministic:
      r.assignmentStatsDeterministic?.wrongAssignments ?? null,
    wrongAssignmentsFinal: r.assignmentStats.wrongAssignments,
    latency: r.latency ?? null,
    usage: r.semantic?.usage ?? null,
    decisions: r.semantic?.decisions ?? [],
    reconcileNotes: r.semantic?.reconcileNotes ?? [],
    llmError: r.semantic?.llmError ?? null,
  }));

  const liveJson = {
    meta: {
      generatedAt: new Date().toISOString(),
      phaseBLlm: true,
      piiPolicy: "No emails/phones/full resume text in this artifact.",
      modelHint: "GEMINI_MODEL from env (not echoed with secrets)",
    },
    recommendation: {
      title: recommendation.title,
      rationale: recommendation.rationale,
    },
    summary: {
      overall: {
        wrongFieldAPlus: pb.wrongFieldRateDeterministic,
        wrongFieldAfterGemini: pb.wrongFieldRateAfterReconcile,
        p0: summary.severityCounts.P0,
        p1: summary.severityCounts.P1,
        p2: summary.severityCounts.P2,
      },
      fieldMetricsAfter: fm,
      fieldMetricsDeterministic: {
        experiences: {
          precision: pb.experiencePrecisionDeterministic,
        },
        projects: { precision: pb.projectPrecisionDeterministic },
        educations: { precision: pb.educationPrecisionDeterministic },
      },
      safety: {
        experiencePrecision: fm.experiences.precision,
        experienceFp: fm.experiences.fp,
        projectAsExperience: summary.codeCounts["PROJECT_AS_EXPERIENCE"] ?? 0,
        p0: summary.severityCounts.P0,
      },
      llm: pb,
    },
    focusCases: results
      .filter((r) => focusStems.some((s) => r.stem.includes(`resume-${s}-`) || r.stem.includes(`-${s}-`)))
      .map((r) => ({
        file: r.file,
        stem: r.stem,
        reasons: r.semantic?.reasons,
        impact: r.semantic?.impact,
        attempted: r.semantic?.attempted,
        llmSuccess: r.semantic?.llmSuccess,
        wrongDet: r.assignmentStatsDeterministic?.wrongAssignments,
        wrongFinal: r.assignmentStats.wrongAssignments,
        experienceFpDet: r.scoresDeterministic?.experiences.falsePositive,
        experienceFpFinal: r.scores?.experiences.falsePositive,
      })),
    hallucinationAudit: hallucinationFlags,
    perFile,
  };

  const jsonPath = join(OUT_DIR, "phase-b-live-results.json");
  writeFileSync(jsonPath, JSON.stringify(liveJson, null, 2), "utf8");

  const md: string[] = [];
  md.push(`# PHASE B LIVE RESULTS`);
  md.push(``);
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(``);
  md.push(`## Executive verdict`);
  md.push(``);
  md.push(`**${recommendation.title}**`);
  md.push(``);
  for (const r of recommendation.rationale) md.push(`- ${r}`);
  md.push(``);
  md.push(`## Benchmark (A+ vs A+ + Gemini)`);
  md.push(``);
  md.push(`| Metric | A+ | A+ + Gemini |`);
  md.push(`| ------ | --: | ----------: |`);
  md.push(
    `| Wrong-field rate | ${pct(pb.wrongFieldRateDeterministic)} | ${pct(pb.wrongFieldRateAfterReconcile)} |`
  );
  for (const [name, m] of Object.entries(fm)) {
    md.push(
      `| ${name} P/R | (see det columns in JSON) | ${pct(m.precision)} / ${pct(m.recall)} |`
    );
  }
  md.push(`| Experience precision | ${pct(pb.experiencePrecisionDeterministic)} | ${pct(pb.experiencePrecisionAfter)} |`);
  md.push(`| Project precision | ${pct(pb.projectPrecisionDeterministic)} | ${pct(pb.projectPrecisionAfter)} |`);
  md.push(`| Education precision | ${pct(pb.educationPrecisionDeterministic)} | ${pct(pb.educationPrecisionAfter)} |`);
  md.push(`| P0 | ${summary.severityCounts.P0} | ${summary.severityCounts.P0} |`);
  md.push(`| P1 | — | ${summary.severityCounts.P1} |`);
  md.push(`| P2 | — | ${summary.severityCounts.P2} |`);
  md.push(``);
  md.push(`## LLM effectiveness`);
  md.push(``);
  md.push(`| Metric | Value |`);
  md.push(`| ------ | ----: |`);
  md.push(`| Total files | ${pb.totalResumes} |`);
  md.push(`| Ambiguous files | ${pb.llmCandidateResumes} |`);
  md.push(`| Invocation eligibility rate | ${pct(pb.ambiguityInvocationRate)} |`);
  md.push(`| LLM attempted | ${pb.llmAttempted} |`);
  md.push(`| LLM success | ${pb.llmSuccess} |`);
  md.push(`| LLM failures | ${pb.llmFailures} |`);
  md.push(`| Timeouts | ${pb.timeouts} |`);
  md.push(`| Retries | ${pb.retries} |`);
  md.push(`| Accepted decisions | ${pb.llmAcceptedDecisions} |`);
  md.push(`| Rejected decisions | ${pb.llmRejectedDecisions} |`);
  md.push(`| Unsupported decisions | ${pb.llmUnsupportedDecisions} |`);
  md.push(`| Leave-empty decisions | ${pb.leaveEmptyDecisions} |`);
  md.push(`| Reclassify decisions | ${pb.reclassifyDecisions} |`);
  md.push(`| Useful corrections | ${pb.usefulCorrections} |`);
  md.push(`| No-op verifications | ${pb.noopVerifications} |`);
  md.push(`| Harmful corrections | ${pb.harmfulCorrections} |`);
  md.push(`| Failed verifications | ${pb.failedVerifications} |`);
  md.push(``);
  md.push(`## Cost`);
  md.push(``);
  if (!pb.tokenUsage.available) {
    md.push(pb.tokenUsage.note);
  } else {
    md.push(`| Metric | Value |`);
    md.push(`| ------ | ----: |`);
    md.push(`| Samples with usage | ${pb.tokenUsage.samples} |`);
    md.push(`| Avg input tokens | ${pb.tokenUsage.averageInputTokens?.toFixed(1) ?? "n/a"} |`);
    md.push(`| Avg output tokens | ${pb.tokenUsage.averageOutputTokens?.toFixed(1) ?? "n/a"} |`);
    md.push(`| Avg total tokens | ${pb.tokenUsage.averageTotalTokens?.toFixed(1) ?? "n/a"} |`);
    md.push(
      `| Tokens per useful correction | ${pb.tokenUsage.tokensPerUsefulCorrection?.toFixed(1) ?? "n/a"} |`
    );
  }
  md.push(``);
  md.push(`## Latency`);
  md.push(``);
  md.push(`| Path | avg | p50 | p95 | max |`);
  md.push(`| ---- | --: | --: | --: | --: |`);
  const L = pb.latency;
  md.push(
    `| Deterministic parse | ${ms(L.deterministic.avg)} | ${ms(L.deterministic.p50)} | ${ms(L.deterministic.p95)} | ${ms(L.deterministic.max)} |`
  );
  md.push(
    `| LLM call | ${ms(L.llm.avg)} | ${ms(L.llm.p50)} | ${ms(L.llm.p95)} | ${ms(L.llm.max)} |`
  );
  md.push(
    `| Total (all) | ${ms(L.total.avg)} | ${ms(L.total.p50)} | ${ms(L.total.p95)} | ${ms(L.total.max)} |`
  );
  md.push(
    `| Total (LLM-verified only) | ${ms(L.llmVerifiedOnly.avg)} | ${ms(L.llmVerifiedOnly.p50)} | ${ms(L.llmVerifiedOnly.p95)} | ${ms(L.llmVerifiedOnly.max)} |`
  );
  md.push(
    `| Total (deterministic-only) | ${ms(L.deterministicOnly.avg)} | ${ms(L.deterministicOnly.p50)} | ${ms(L.deterministicOnly.p95)} | ${ms(L.deterministicOnly.max)} |`
  );
  md.push(``);
  md.push(`## Safety`);
  md.push(``);
  md.push(`| Check | Value |`);
  md.push(`| ----- | ----: |`);
  md.push(`| Experience precision | ${pct(fm.experiences.precision)} |`);
  md.push(`| Experience FP | ${fm.experiences.fp} |`);
  md.push(`| PROJECT_AS_EXPERIENCE | ${summary.codeCounts["PROJECT_AS_EXPERIENCE"] ?? 0} |`);
  md.push(`| P0 | ${summary.severityCounts.P0} |`);
  md.push(``);
  md.push(`## Focus cases (b02/b11/b12/b23/b28)`);
  md.push(``);
  for (const row of liveJson.focusCases) {
    md.push(
      `- **${row.file}**: impact=${row.impact}, attempted=${row.attempted}, llmSuccess=${row.llmSuccess}, wrong ${row.wrongDet}→${row.wrongFinal}, expFP ${row.experienceFpDet}→${row.experienceFpFinal}, reasons=${(row.reasons ?? []).join(",")}`
    );
  }
  md.push(``);
  md.push(`## Ambiguous files`);
  md.push(``);
  for (const r of ambiguous) {
    md.push(
      `- ${r.file}: impact=${r.semantic?.impact}, invoked=${r.semantic?.attempted}, success=${r.semantic?.llmSuccess}, reasons=${(r.semantic?.reasons ?? []).join(",")}`
    );
  }
  md.push(``);
  md.push(`## Hallucination audit`);
  md.push(``);
  if (hallucinationFlags.length === 0) {
    md.push(`No unsupported accepted decisions flagged via reconcile notes.`);
  } else {
    for (const h of hallucinationFlags) {
      md.push(`- ${h.file}: ${h.note}`);
    }
  }
  md.push(``);

  writeFileSync(join(OUT_DIR, "PHASE_B_LIVE_RESULTS.md"), md.join("\n"), "utf8");

  const decisionMd = [
    `# PHASE B DECISION`,
    ``,
    `## Verdict: ${recommendation.title}`,
    ``,
    ...recommendation.rationale.map((r) => `- ${r}`),
    ``,
    `### Framework mapping`,
    ``,
    `- READY FOR STAGING → PROCEED`,
    `- NEEDS PHASE B+ → PHASE B+`,
    `- DETERMINISTIC ONLY → DETERMINISTIC ONLY`,
    `- ROLLBACK → ROLLBACK`,
    ``,
    `### Key numbers`,
    ``,
    `- Wrong-field: ${pct(pb.wrongFieldRateDeterministic)} → ${pct(pb.wrongFieldRateAfterReconcile)}`,
    `- Useful / no-op / harmful: ${pb.usefulCorrections} / ${pb.noopVerifications} / ${pb.harmfulCorrections}`,
    `- LLM success / fail: ${pb.llmSuccess} / ${pb.llmFailures}`,
    `- Experience precision: ${pct(fm.experiences.precision)} (FP=${fm.experiences.fp})`,
    `- PROJECT_AS_EXPERIENCE: ${summary.codeCounts["PROJECT_AS_EXPERIENCE"] ?? 0}`,
    `- P0: ${summary.severityCounts.P0}`,
    `- Ambiguity rate: ${pct(pb.ambiguityInvocationRate)}`,
    ``,
  ].join("\n");
  writeFileSync(join(OUT_DIR, "PHASE_B_DECISION.md"), decisionMd, "utf8");

  console.error(
    `Phase B live artifacts: ${jsonPath}, PHASE_B_LIVE_RESULTS.md, PHASE_B_DECISION.md`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(CORPUS_ROOT)) {
    console.error(`Corpus not found at ${CORPUS_ROOT}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(REVIEW_DIR, { recursive: true });

  const groundTruth = loadGroundTruth();
  for (const [stem, gt] of groundTruth) {
    styleByStem.set(stem, gt.template_style);
  }

  const benchmarkFiles = listResumeFiles(BENCHMARK_DIR).map((f) => ({
    path: join(BENCHMARK_DIR, f),
    corpus: "benchmark-set" as const,
  }));
  const legacyFiles = listResumeFiles(LEGACY_DIR).map((f) => ({
    path: join(LEGACY_DIR, f),
    corpus: "legacy" as const,
  }));

  const all = [...benchmarkFiles, ...legacyFiles];
  console.error(`Discovered ${all.length} resume files (${groundTruth.size} golden stems).`);

  const results: ResumeEval[] = [];
  for (const item of all) {
    process.stderr.write(`Evaluating ${basename(item.path)}...\n`);
    const row = await evaluateFile(item.path, item.corpus, groundTruth);
    results.push(row);
    if (row.validationStatus !== "VALIDATED") {
      writeReviewSheet(row);
    }
  }

  const summary = aggregate(results);
  const recommendation = decideRecommendation(summary);

  // Pattern answers
  const totalLayer =
    Object.values(summary.layerCounts).reduce((a, b) => a + b, 0) || 1;
  const patterns = {
    q1_primary_failure_class:
      summary.layerCounts.A / totalLayer >= 0.35
        ? "Extraction/layout"
        : "Semantic classification",
    q2_pdf_vs_docx: (() => {
      const pdfWrong = results
        .filter((r) => r.type === "pdf" && r.validationStatus === "VALIDATED")
        .reduce((s, r) => s + r.assignmentStats.wrongAssignments, 0);
      const docxWrong = results
        .filter((r) => r.type === "docx" && r.validationStatus === "VALIDATED")
        .reduce((s, r) => s + r.assignmentStats.wrongAssignments, 0);
      if (pdfWrong === docxWrong) return "Similar PDF and DOCX wrong-assignment counts";
      return pdfWrong > docxWrong
        ? `PDF worse (wrong assignments PDF=${pdfWrong} DOCX=${docxWrong})`
        : `DOCX worse (wrong assignments PDF=${pdfWrong} DOCX=${docxWrong})`;
    })(),
    q3_weakest_fields: Object.entries(summary.fieldMetrics)
      .map(([k, v]) => ({ field: k, precision: v.precision ?? 0, recall: v.recall ?? 0 }))
      .sort((a, b) => a.precision - b.precision || a.recall - b.recall)
      .slice(0, 5)
      .map((x) => `${x.field} (P=${pct(x.precision)}, R=${pct(x.recall)})`),
    q4_p0_events: summary.severityCounts.P0,
    q5_llm_need: recommendation.llmNeedEstimate,
  };

  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      parser: "deterministic-v2 + selective-semantic-v1",
      evaluationOnly: true,
      phaseBLlm: process.env.PHASE_B_LLM === "1",
      validationNote:
        "Precision/recall and wrong-field rates use human ground-truth from benchmark-set/ground-truth.json only. Legacy resume-01..05 are UNVALIDATED.",
      corpusRoot: CORPUS_ROOT,
      groundTruthPath: GROUND_TRUTH_PATH,
      groundTruthStems: groundTruth.size,
      piiPolicy: "Emails/phones omitted from parsed snapshots; review sheets omit contact PII.",
    },
    summary,
    patterns,
    recommendation,
    results: results.map((r) => ({
      ...r,
      // Keep results useful but avoid dumping contact PII (never present in parsed snapshot).
      idHash: hashId(r.file),
    })),
  };

  const jsonPath = join(OUT_DIR, "resume-evaluation-results.json");
  const mdPath = join(OUT_DIR, "RESUME_CORPUS_BENCHMARK.md");
  const recPath = join(OUT_DIR, "RECOMMENDATION.md");

  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  writeFileSync(mdPath, renderMarkdownReport(summary, results), "utf8");
  writeFileSync(
    recPath,
    [
      `# RECOMMENDATION`,
      ``,
      `## Option ${recommendation.option} — ${recommendation.title}`,
      ``,
      ...recommendation.rationale.map((r) => `- ${r}`),
      ``,
      `### LLM need estimate`,
      ``,
      recommendation.llmNeedEstimate,
      ``,
      `### Pattern answers`,
      ``,
      `1. Primary failure class: **${patterns.q1_primary_failure_class}**`,
      `2. PDF vs DOCX: **${patterns.q2_pdf_vs_docx}**`,
      `3. Weakest fields: ${patterns.q3_weakest_fields.join("; ")}`,
      `4. P0 failure events: **${patterns.q4_p0_events}**`,
      `5. LLM: ${patterns.q5_llm_need}`,
      ``,
    ].join("\n"),
    "utf8"
  );

  if (process.env.PHASE_B_LLM === "1") {
    writePhaseBLiveArtifacts({
      summary,
      results,
      recommendation,
      payload,
    });
  }

  // Golden mirror note for tests/fixtures
  const goldenNoteDir = join(AMS_ROOT, "tests", "fixtures", "resumes", "golden");
  mkdirSync(goldenNoteDir, { recursive: true });
  writeFileSync(
    join(goldenNoteDir, "README.md"),
    [
      `# Golden expectations`,
      ``,
      `Authoritative ground truth for the benchmark-set lives outside the app tree:`,
      ``,
      `\`${GROUND_TRUTH_PATH}\``,
      ``,
      `- ${groundTruth.size} labeled resumes (b01–b28)`,
      `- Companion matrix: \`synthetic-resumes/benchmark-set/benchmark-matrix.csv\``,
      ``,
      `Legacy root resumes (resume-01..05) do **not** yet have golden labels.`,
      `Human review sheets are generated under:`,
      ``,
      `\`${REVIEW_DIR}\``,
      ``,
      `Do not treat parser output as expected truth.`,
      ``,
    ].join("\n"),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        outDir: OUT_DIR,
        jsonPath,
        mdPath,
        recPath,
        recommendation: recommendation.option,
        validated: summary.corpus.validatedFiles,
        unvalidated: summary.corpus.unvalidatedFiles,
        wrongFieldRate: summary.rates.wrongFieldAssignmentRate,
        p0: summary.severityCounts.P0,
        p1: summary.severityCounts.P1,
        p2: summary.severityCounts.P2,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
