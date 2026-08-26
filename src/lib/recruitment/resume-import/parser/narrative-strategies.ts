/**
 * Narrative-sentence strategies for resumes that describe experience/education
 * in prose instead of structured lines (e.g. "Worked as X at Y from 2024 to 2026.").
 *
 * Each strategy is a pure, independently-testable function. They only fire on
 * strong internal evidence (an explicit date range for experience; a degree
 * keyword + "from {institution}" shape for education) to avoid misreading
 * unrelated prose as employment/education history.
 */
import { normalizeWhitespace } from "./cleanup";
import {
  JOB_TITLE_SIGNAL_RE,
  looksLikeJobTitle,
  normalizeResumeDate,
} from "./patterns";
import type { ParsedResumeEducation, ParsedResumeExperience } from "./types";

const WORKED_AS_RE = /^(?:worked|working)\s+as\s+(.+?)(?:\s+at\s+(.+))?$/i;
const TITLE_AT_COMPANY_RE = /^(.+?)\s+at\s+(.+)$/i;

/**
 * Bare year/year-range only — deliberately narrower than the shared
 * `parseDateRange`, whose optional "month abbreviation" prefix
 * (`[A-Za-z]{3,9}\.?\s+`) greedily swallows an ordinary preceding word
 * (e.g. "...Skygamut Solutions Pvt Ltd 2024 to 2026" → raw match becomes
 * "Ltd 2024 to 2026", and `normalizeResumeDate("Ltd 2024")` then fails to
 * parse). Narrative sentences in this codebase's observed corpus always
 * trail with a plain "YYYY to YYYY" / "YYYY to Present" form, so anchoring
 * strictly to digit-years avoids the shared function's bug without touching
 * it (it is used by many structured-line strategies already covered by the
 * existing 143-test regression suite).
 */
const NARRATIVE_DATE_RANGE_RE =
  /\b((?:19|20)\d{2})\s*(?:to|until|[-–—])\s*((?:19|20)\d{2}|present|current|now|ongoing)\b/i;

function parseNarrativeDateRange(text: string): {
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  raw: string;
} | null {
  const m = text.match(NARRATIVE_DATE_RANGE_RE);
  if (!m) return null;
  const startDate = normalizeResumeDate(m[1]);
  const endRaw = m[2]!;
  const isCurrent = /present|current|now|ongoing/i.test(endRaw);
  const endDate = isCurrent ? null : normalizeResumeDate(endRaw);
  return { startDate, endDate, isCurrent, raw: m[0]! };
}

/**
 * Matches:
 *   Worked as {title} at {company} {dateRange}
 *   Working as {title} at {company} {dateRange}
 *   Worked as {title} {dateRange}            (no company — never invented)
 *   Working as {title} {dateRange}
 *   {title} at {company} {dateRange}
 *
 * Requires an explicit parseable date range as evidence this is a genuine
 * employment sentence, not arbitrary prose.
 */
export function parseNarrativeExperienceLine(
  line: string
): ParsedResumeExperience | null {
  const cleaned = normalizeWhitespace(line).replace(/[.]+$/, "");
  if (!cleaned) return null;

  const range = parseNarrativeDateRange(cleaned);
  if (!range) return null;

  const dateIndex = cleaned.indexOf(range.raw);
  if (dateIndex < 0) return null;
  const withoutDate = normalizeWhitespace(cleaned.slice(0, dateIndex)).replace(
    /[,.\-–—]+$/,
    ""
  );
  if (!withoutDate) return null;

  let title: string | null = null;
  let company: string | null = null;

  const workedAsMatch = withoutDate.match(WORKED_AS_RE);
  if (workedAsMatch) {
    title = normalizeWhitespace(workedAsMatch[1]!);
    company = workedAsMatch[2] ? normalizeWhitespace(workedAsMatch[2]!) : null;
  } else {
    const atMatch = withoutDate.match(TITLE_AT_COMPANY_RE);
    if (atMatch) {
      title = normalizeWhitespace(atMatch[1]!);
      company = normalizeWhitespace(atMatch[2]!);
    }
  }

  if (!title || !looksLikeJobTitle(title)) return null;

  return {
    // "" (never null) — company is a non-nullable DB/type column; empty
    // string is this pipeline's established "no value" sentinel, already
    // treated as absent by every downstream weak-value/dedup check.
    company: company ?? "",
    title,
    location: null,
    startDate: range.startDate,
    endDate: range.endDate,
    isCurrent: range.isCurrent,
    description: null,
  };
}

/** Scan every line of a headerless narrative document for experience sentences. */
export function collectNarrativeExperiences(
  lines: string[]
): ParsedResumeExperience[] {
  const out: ParsedResumeExperience[] = [];
  for (const line of lines) {
    const parsed = parseNarrativeExperienceLine(line);
    if (parsed) out.push(parsed);
  }
  return out;
}

const NARRATIVE_DEGREE_HINT_RE =
  /\b(pharmacy|intermediate|s\.?s\.?c|h\.?s\.?c|puc|diploma|bachelor|master|b\.?tech|m\.?tech|mba|mca|bca|bba|b\.?sc|m\.?sc|b\.?a\b|m\.?a\b|b\.?com|m\.?com|ph\.?d)\b/i;

const NARRATIVE_WITH_CLAUSE_RE = /\s+(?:with|wih|wth)\b/i;
const NARRATIVE_PERCENT_RE = /\(?\d{1,3}(?:\.\d{1,2})?\s*%\)?/;

/**
 * Matches:
 *   {degree} from {institution}
 *   {degree} from {institution} with {percentage}
 *
 * Requires a recognizable degree keyword before "from" — bare "X from Y"
 * prose (e.g. a summary sentence) is not treated as an education record.
 */
export function parseNarrativeEducationLine(
  line: string
): ParsedResumeEducation | null {
  const cleaned = normalizeWhitespace(line).replace(/[.]+$/, "");
  if (!cleaned) return null;

  const match = cleaned.match(/^(.+?)\s+from\s+(.+)$/i);
  if (!match) return null;

  const degreePart = normalizeWhitespace(match[1]!);
  if (!NARRATIVE_DEGREE_HINT_RE.test(degreePart)) return null;

  let institutionPart = match[2]!;
  const withIdx = institutionPart.search(NARRATIVE_WITH_CLAUSE_RE);
  const percentIdx = institutionPart.search(NARRATIVE_PERCENT_RE);
  let cutIdx = -1;
  if (withIdx >= 0) cutIdx = withIdx;
  else if (percentIdx >= 0) cutIdx = percentIdx;
  if (cutIdx >= 0) institutionPart = institutionPart.slice(0, cutIdx);
  institutionPart = normalizeWhitespace(
    institutionPart.replace(/[,.\-–—]+$/, "")
  );

  if (institutionPart.length < 3) return null;
  // Guard against the job-title strategy's vocabulary bleeding into education
  // (e.g. "worked from home" style sentences containing role signal words).
  if (JOB_TITLE_SIGNAL_RE.test(degreePart)) return null;

  const yearMatches = cleaned.match(/\b(19|20)\d{2}\b/g);
  const graduationYear = yearMatches
    ? Number(yearMatches[yearMatches.length - 1])
    : null;

  return {
    institution: institutionPart,
    degree: degreePart,
    field: null,
    graduationYear,
  };
}

/** Scan every line of a headerless narrative document for education sentences. */
export function collectNarrativeEducations(
  lines: string[]
): ParsedResumeEducation[] {
  const out: ParsedResumeEducation[] = [];
  for (const line of lines) {
    const parsed = parseNarrativeEducationLine(line);
    if (parsed) out.push(parsed);
  }
  return out;
}
