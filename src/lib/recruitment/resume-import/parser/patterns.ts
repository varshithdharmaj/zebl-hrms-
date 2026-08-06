import { normalizeWhitespace } from "./cleanup";

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const LINKEDIN_RE =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/gi;

/** Prefer complete phone numbers (10–15 digits). */
const PHONE_CANDIDATE_RE =
  /(?:\+\d{1,3}[\s.-]*)?(?:\(?\d{2,4}\)?[\s.-]*)?\d{3,5}[\s.-]*\d{3,5}(?:\s*(?:ext|x|extension)\.?\s*\d+)?/gi;

export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const onlyDigits = trimmed.replace(/\D/g, "");
  if (onlyDigits.length < 10 || onlyDigits.length > 15) return null;
  if (hasPlus) return `+${onlyDigits}`;
  if (onlyDigits.length === 10) return onlyDigits;
  if (onlyDigits.length === 11 && onlyDigits.startsWith("1")) return `+${onlyDigits}`;
  if (onlyDigits.length === 12 && onlyDigits.startsWith("91")) return `+${onlyDigits}`;
  return onlyDigits;
}

export function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_CANDIDATE_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    if (raw.includes("@")) continue;
    if (/^\d{4}$/.test(raw.trim())) continue;
    const normalized = normalizePhone(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  // Prefer longer / international numbers first
  out.sort((a, b) => b.replace(/\D/g, "").length - a.replace(/\D/g, "").length);
  return out;
}

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

export function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const email = raw.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function extractLinkedInUrls(text: string): string[] {
  const matches = text.match(LINKEDIN_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    let url = raw.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    url = url.replace(/\/+$/, "");
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

/**
 * Normalize a date token to YYYY-MM-DD (day defaults to 01) or YYYY-01-01.
 * Returns null when unparseable.
 */
export function normalizeResumeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = normalizeWhitespace(raw).toLowerCase();
  if (!value || /present|current|now|ongoing|till\s*date|to\s*date/.test(value)) {
    return null;
  }

  // YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  let m = value.match(/^(\d{4})[./-](\d{1,2})(?:[./-](\d{1,2}))?$/);
  if (m) {
    const y = m[1]!;
    const mo = m[2]!.padStart(2, "0");
    const d = (m[3] ?? "01").padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  // MM/YYYY or MM-YYYY
  m = value.match(/^(\d{1,2})[./-](\d{4})$/);
  if (m) {
    return `${m[2]}-${m[1]!.padStart(2, "0")}-01`;
  }

  // Month YYYY / Mon YYYY
  m = value.match(/^([a-z]+)\.?\s+(\d{4})$/i);
  if (m) {
    const mo = MONTH_MAP[m[1]!.toLowerCase()];
    if (mo) return `${m[2]}-${mo}-01`;
  }

  // YYYY only
  m = value.match(/^(\d{4})$/);
  if (m) {
    const year = Number(m[1]);
    if (year >= 1950 && year <= 2100) return `${m[1]}-01-01`;
  }

  return null;
}

export function parseDateRange(line: string): {
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
} | null {
  const cleaned = normalizeWhitespace(line);
  // e.g. Jan 2020 – Present | 2019-2022 | 01/2018 to 06/2020
  const rangeRe =
    /((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|\d{1,2}[./-]\d{4}|\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?)\s*(?:–|—|-|to|until)\s*((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|\d{1,2}[./-]\d{4}|\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?|present|current|now|ongoing)/i;

  const m = cleaned.match(rangeRe);
  if (!m) return null;

  const startDate = normalizeResumeDate(m[1]);
  const endRaw = m[2]!;
  const isCurrent = /present|current|now|ongoing/i.test(endRaw);
  const endDate = isCurrent ? null : normalizeResumeDate(endRaw);
  return { startDate, endDate, isCurrent };
}

export function extractYearsOfExperience(text: string): string | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:total\s+)?experience/i,
    /experience\s*[:\-]?\s*(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i,
    /total\s+experience\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function looksLikeName(line: string): boolean {
  const value = normalizeWhitespace(line);
  if (value.length < 3 || value.length > 60) return false;
  if (/@|https?:|linkedin\.com|\d{5,}/i.test(value)) return false;
  if (/experience|education|skills|summary|objective|profile|projects/i.test(value)) {
    return false;
  }
  const words = value.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  return words.every((w) => /^[A-Za-z][A-Za-z'.-]*$/.test(w));
}

export function looksLikeLocation(line: string): boolean {
  const value = normalizeWhitespace(line);
  if (value.length < 3 || value.length > 80) return false;
  if (/@|https?:|linkedin/i.test(value)) return false;
  // City, Country / City, ST
  if (/^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$/.test(value)) return true;
  if (/^(remote|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|pune|london|new york|san francisco)/i.test(value)) {
    return true;
  }
  return false;
}
