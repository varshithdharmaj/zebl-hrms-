import { normalizeWhitespace } from "./cleanup";

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const LINKEDIN_RE =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/gi;

/** Profile or repo path; normalized to profile for Candidate.githubUrl. */
const GITHUB_RE =
  /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}(?:\/[A-Za-z0-9._-]+)?\/?(?:\?[^\s<>"')\]]*)?(?:#[^\s<>"')\]]*)?/gi;

const GENERIC_URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

const SOCIAL_HOST_RE =
  /linkedin\.com|github\.com|gitlab\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|wa\.me|mailto:/i;

/** Hosts that must never become CandidatePersonal.portfolioUrl. */
const PORTFOLIO_DENY_HOST_RE =
  /(?:^|\.)(?:linkedin\.com|github\.com|gitlab\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|wa\.me|leetcode\.com|hackerrank\.com|codechef\.com|codeforces\.com|stackoverflow\.com|stackexchange\.com|kaggle\.com|credly\.com|coursera\.org|udemy\.com|udacity\.com|edx\.org|pluralsight\.com|microsoft\.com|google\.com|aws\.amazon\.com|cloud\.google\.com|azure\.microsoft\.com|oracle\.com|salesforce\.com|notion\.so|medium\.com|dev\.to|behance\.net|dribbble\.com)\b/i;

const PORTFOLIO_LABEL_RE =
  /^(?:portfolio|website|personal\s+site|personal\s+website|web\s*site)\s*[:\-–—]\s*(.+)$/i;

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

function normalizeHttpUrl(raw: string): string {
  let url = raw.trim().replace(/[),.;]+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  // Drop query/hash for stable identity.
  url = url.replace(/[?#].*$/, "");
  return url.replace(/\/+$/, "");
}

/** Profile URL only (strip repo path) — for Candidate.githubUrl. */
export function toGitHubProfileUrl(url: string): string | null {
  const normalized = normalizeHttpUrl(url);
  const m = normalized.match(
    /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})(?:\/|$)/i
  );
  if (!m?.[1]) return null;
  const user = m[1];
  if (/^(topics|features|pricing|about|login|orgs|settings|marketplace)$/i.test(user)) {
    return null;
  }
  return `https://github.com/${user}`;
}

export function extractLinkedInUrls(text: string): string[] {
  const matches = text.match(LINKEDIN_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const url = normalizeHttpUrl(raw);
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

/**
 * GitHub profile URLs for the candidate contact field.
 * Repo paths are collapsed to the profile; marketing paths skipped.
 */
export function extractGitHubUrls(text: string): string[] {
  const matches = text.match(GITHUB_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const profile = toGitHubProfileUrl(raw);
    if (!profile) continue;
    const key = profile.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(profile);
  }
  return out;
}

/** Full GitHub URLs (including repos) for project.url. */
export function extractGitHubProjectUrls(text: string): string[] {
  const matches = text.match(GITHUB_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const url = normalizeHttpUrl(raw);
    if (/github\.com\/(topics|features|pricing|about|login|orgs)\b/i.test(url)) {
      continue;
    }
    if (!/github\.com\//i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

export function isDeniedPortfolioHost(url: string): boolean {
  try {
    const host = new URL(normalizeHttpUrl(url)).hostname.toLowerCase();
    return PORTFOLIO_DENY_HOST_RE.test(host) || SOCIAL_HOST_RE.test(host);
  } catch {
    return true;
  }
}

/**
 * Conservative portfolio extraction.
 * Prefers labeled lines; otherwise only non-denied https URLs from a small header window.
 */
export function extractPortfolioUrls(
  text: string,
  options?: { headerOnly?: boolean; headerLines?: string[] }
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const url = normalizeHttpUrl(raw);
    if (!/^https?:\/\//i.test(url)) return;
    if (isDeniedPortfolioHost(url)) return;
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(url);
  };

  const headerLines = options?.headerLines ?? [];
  for (const line of headerLines) {
    const labeled = line.match(PORTFOLIO_LABEL_RE);
    if (labeled?.[1]) {
      const candidate = labeled[1].trim();
      const urls = candidate.match(GENERIC_URL_RE) ?? [];
      if (urls.length) {
        for (const u of urls) push(u);
      } else if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(candidate)) {
        push(candidate);
      }
    }
  }

  if (out.length > 0) return out;

  // Labeled anywhere in text (still conservative).
  for (const line of text.split(/\n+/)) {
    const labeled = line.match(PORTFOLIO_LABEL_RE);
    if (!labeled?.[1]) continue;
    const urls = labeled[1].match(GENERIC_URL_RE) ?? [];
    for (const u of urls) push(u);
  }
  if (out.length > 0) return out;

  if (options?.headerOnly !== false && headerLines.length > 0) {
    const headerText = headerLines.join("\n");
    for (const raw of headerText.match(GENERIC_URL_RE) ?? []) {
      push(raw);
    }
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

  let m = value.match(/^(\d{4})[./-](\d{1,2})(?:[./-](\d{1,2}))?$/);
  if (m) {
    const y = m[1]!;
    const mo = m[2]!.padStart(2, "0");
    const d = (m[3] ?? "01").padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  m = value.match(/^(\d{1,2})[./-](\d{4})$/);
  if (m) {
    return `${m[2]}-${m[1]!.padStart(2, "0")}-01`;
  }

  m = value.match(/^([a-z]+)\.?\s+(\d{4})$/i);
  if (m) {
    const mo = MONTH_MAP[m[1]!.toLowerCase()];
    if (mo) return `${m[2]}-${mo}-01`;
  }

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
  raw: string;
} | null {
  const cleaned = normalizeWhitespace(line);
  const rangeRe =
    /((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|\d{1,2}[./-]\d{4}|\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?)\s*(?:–|—|-|to|until)\s*((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|\d{1,2}[./-]\d{4}|\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?|present|current|now|ongoing)/i;

  const m = cleaned.match(rangeRe);
  if (!m) return null;

  const startDate = normalizeResumeDate(m[1]);
  const endRaw = m[2]!;
  const isCurrent = /present|current|now|ongoing/i.test(endRaw);
  const endDate = isCurrent ? null : normalizeResumeDate(endRaw);
  return { startDate, endDate, isCurrent, raw: m[0]! };
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

/** Job-title lexical signal — shared by experience + headline precision gates. */
export const JOB_TITLE_SIGNAL_RE =
  /\b(engineer|developer|manager|analyst|consultant|architect|designer|scientist|specialist|director|intern|lead|officer|administrator|programmer|associate|firmware|sde|swe|sre|devops|dba|writer|trainer|coordinator|executive|recruiter|prof{1,2}ess?or|teacher)\b/i;

export function looksLikeJobTitle(line: string): boolean {
  const value = normalizeWhitespace(line);
  if (value.length < 3 || value.length > 90) return false;
  if (/@|https?:|linkedin\.com/i.test(value)) return false;
  if (looksLikeName(value)) return false;
  if (
    /\b(B\.?Tech|B\.?E\.?|M\.?Tech|M\.?S\.?|MBA|MCA|BCA|Ph\.?D\.?|Bachelor|Master|Diploma)\b/i.test(
      value
    ) &&
    !JOB_TITLE_SIGNAL_RE.test(value)
  ) {
    return false;
  }
  return JOB_TITLE_SIGNAL_RE.test(value);
}

/**
 * Strong header headline evidence (not name, not location, not a bare project title).
 */
export function looksLikeHeadline(line: string): boolean {
  const value = normalizeWhitespace(line);
  if (value.length < 3 || value.length > 120) return false;
  if (looksLikeName(value)) return false;
  if (looksLikeLocation(value)) return false;
  if (/@|https?:|linkedin\.com|github\.com/i.test(value)) return false;
  if (extractEmails(value).length || extractPhones(value).length) return false;
  if (
    /\b(management\s+system|tracking\s+system|portal|dashboard|(?:web|mobile)\s+app)\b/i.test(
      value
    ) &&
    !JOB_TITLE_SIGNAL_RE.test(value)
  ) {
    return false;
  }
  if (looksLikeJobTitle(value)) return true;
  // "Senior Backend Engineer | Node.js | PostgreSQL" style without repeating title words twice
  if (/[|·—–]/.test(value) && JOB_TITLE_SIGNAL_RE.test(value)) return true;
  return false;
}

export function looksLikeName(line: string): boolean {
  const value = normalizeWhitespace(line);
  if (value.length < 3 || value.length > 60) return false;
  if (/@|https?:|linkedin\.com|\d{5,}/i.test(value)) return false;
  if (
    /experience|education|skills|summary|objective|profile|projects|contact|languages|certifications/i.test(
      value
    )
  ) {
    return false;
  }
  if (/^(contact|contacts|details|candidate\s+details|personal\s+details)$/i.test(value)) {
    return false;
  }
  if (JOB_TITLE_SIGNAL_RE.test(value)) return false;
  // Employer / org markers — not a person name.
  if (
    /\b(pvt\.?\s*ltd\.?|private\s+limited|ltd\.?|limited|inc\.?|llc|corp\.?|corporation|technologies|technology|systems|solutions|softwares?|labs?|services|university|institute|college)\b/i.test(
      value
    )
  ) {
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
  if (/^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$/.test(value)) {
    const parts = value.split(",").map((p) => p.trim());
    const left = parts[0] ?? "";
    // Avoid treating "Acme Infosystems, City" as a bare location.
    if (
      /\b(infosystems|infotech|technologies|solutions|softwares?|labs?|systems|ltd|limited|inc|llc|corp)\b/i.test(
        left
      )
    ) {
      return false;
    }
    if (left.split(/\s+/).length > 2) return false;
    return true;
  }
  if (/^(remote|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|pune|london|new york|san francisco)/i.test(value)) {
    return true;
  }
  return false;
}

export function extractGenericUrls(text: string): string[] {
  const matches = text.match(GENERIC_URL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const url = normalizeHttpUrl(raw);
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}
