/**
 * Extraction-quality gate.
 *
 * Answers one narrow question: "is this extracted text representation
 * trustworthy enough to feed the deterministic parser?" It does not, and
 * must not, attempt to judge whether the candidate's information is
 * semantically correct or complete — that is the parser/merge layer's job.
 */
import { extractEmails, extractPhones } from "./patterns";
import { matchSectionHeader } from "./sections";

export type ExtractionQualityResult = {
  trustworthy: boolean;
  reasons: string[];
  metrics: {
    charCount: number;
    wordCount: number;
    alphaRatio: number;
    hasEmail: boolean;
    hasPhone: boolean;
    hasSectionHeading: boolean;
  };
};

const MIN_CHAR_COUNT = 120;
const MIN_WORD_COUNT = 25;
const MIN_ALPHA_RATIO = 0.55;
/** Below this word count, a resume-shaped document should show *some* section heading. */
const HEADING_EXPECTED_BELOW_WORD_COUNT = 80;

export function assessExtractionQuality(text: string): ExtractionQualityResult {
  const trimmed = (text ?? "").trim();
  const reasons: string[] = [];

  const charCount = trimmed.length;
  const wordCount = trimmed.length ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const alphaChars = (trimmed.match(/[A-Za-z]/g) ?? []).length;
  const alphaRatio = charCount > 0 ? alphaChars / charCount : 0;
  const hasEmail = extractEmails(trimmed).length > 0;
  const hasPhone = extractPhones(trimmed).length > 0;
  const hasSectionHeading = trimmed
    .split(/\r?\n/)
    .some((line) => matchSectionHeader(line) !== null);

  if (charCount < MIN_CHAR_COUNT) {
    reasons.push(`Extracted text is too short (${charCount} characters).`);
  }
  if (wordCount < MIN_WORD_COUNT) {
    reasons.push(`Extracted text has too few words (${wordCount}).`);
  }
  if (charCount > 0 && alphaRatio < MIN_ALPHA_RATIO) {
    reasons.push(
      `Extracted text has a low alphabetic-character ratio (${alphaRatio.toFixed(2)}), likely garbled.`
    );
  }
  if (!hasEmail && !hasPhone) {
    reasons.push("No contact information (email or phone) detected.");
  }
  if (!hasSectionHeading && wordCount < HEADING_EXPECTED_BELOW_WORD_COUNT) {
    reasons.push(
      "No recognizable resume section heading and body text is short."
    );
  }

  return {
    trustworthy: reasons.length === 0,
    reasons,
    metrics: { charCount, wordCount, alphaRatio, hasEmail, hasPhone, hasSectionHeading },
  };
}
