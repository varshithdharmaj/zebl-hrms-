import { normalizeWhitespace } from "./cleanup";

/**
 * High-confidence resume metadata that must never become skills/certifications.
 * Conservative: require keyword-as-prefix or exact metadata forms, not bare
 * technical phrases like "Availability API" / "Salary Prediction Model".
 */
export function isRecruitmentMetadataText(value: string): boolean {
  const v = normalizeWhitespace(value);
  if (!v) return true;

  // Keyword prefixes that are always compensation/joining metadata.
  if (
    /^(notice\s*period|expected\s*ctc|current\s*ctc|expected\s*salary|current\s*salary|ctc|compensation|immediate\s*joiner|earliest\s*joining|available\s+to\s+join)\b/i.test(
      v
    )
  ) {
    return true;
  }

  // "Availability" alone or with a value separator — not "Availability API".
  if (/^availability(?:\s*[:\-–—].*)?$/i.test(v)) return true;

  // "Joining" / "Joining Date" alone or with separator — not "Joining API".
  if (/^joining(?:\s*date)?(?:\s*[:\-–—].*)?$/i.test(v)) return true;

  // Amount-bearing compensation lines.
  if (/\b\d+(\.\d+)?\s*lpa\b/i.test(v) && /\b(ctc|salary|package|compensation)\b/i.test(v)) {
    return true;
  }

  return false;
}
