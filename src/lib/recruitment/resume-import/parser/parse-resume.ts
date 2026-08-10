import { splitResumeLines, titleCaseName, normalizeWhitespace } from "./cleanup";
import {
  extractEmails,
  extractGitHubProjectUrls,
  extractGitHubUrls,
  extractGenericUrls,
  extractLinkedInUrls,
  extractPhones,
  extractPortfolioUrls,
  extractYearsOfExperience,
  JOB_TITLE_SIGNAL_RE,
  looksLikeHeadline,
  looksLikeJobTitle,
  looksLikeLocation,
  looksLikeName,
  normalizeResumeDate,
  parseDateRange,
} from "./patterns";
import { isRecruitmentMetadataText } from "./recruitment-metadata";
import { detectResumeSections } from "./sections";
import type {
  ParsedResumeCertification,
  ParsedResumeDraft,
  ParsedResumeEducation,
  ParsedResumeExperience,
  ParsedResumeProject,
} from "./types";
import { EMPTY_PARSED_RESUME_DRAFT } from "./types";

const DEGREE_RE =
  /\b(B\.?Tech|B\.?E\.?|B\.?Sc|B\.?S\.?|B\.?A\.?|B\.?Com|B\.?Des|BCA|BBA|M\.?Tech|M\.?S\.?|M\.?Sc|M\.?Com|M\.?B\.?A\.?|MBA|MCA|PGDM|MBBS|LL\.?B|CA|CFA|M\.?Phil|Ph\.?D\.?|Bachelor|Master|Diploma|Associate)\b/i;

const FIELD_IN_RE =
  /\b(?:in|of)\s+([A-Za-z][A-Za-z0-9 &/.-]{2,60})(?:\s*[,|]|\s*$)/i;
const FIELD_DASH_RE =
  /\b(?:B\.?Tech|B\.?E\.?|B\.?Sc|B\.?A\.?|B\.?Des|BCA|BBA|B\.?Com|M\.?Tech|MCA|M\.?Com|MBA|PGDM|MBBS|LL\.?B)\s*[-–—:]\s*([A-Za-z][A-Za-z0-9 &/.-]{2,60})/i;
const FIELD_COMMA_DEGREE_RE =
  /\b(?:B\.?Tech|B\.?E\.?|B\.?Sc|B\.?A\.?|B\.?Des|BCA|BBA|B\.?Com|M\.?Tech|MCA|MBA|PGDM)\s*,\s*([A-Za-z][A-Za-z0-9 &/.-]{2,60})/i;
const FIELD_BEFORE_DEGREE_RE =
  /^([A-Za-z][A-Za-z0-9 &/.-]{2,60})\s*,\s*(?:B\.?Tech|B\.?E\.?|B\.?Sc|B\.?Des|BCA|BBA|B\.?Com|M\.?Tech|MCA|MBA|PGDM)\b/i;

const SKILL_CATEGORY_PREFIX_RE =
  /^(languages?|frameworks?|libraries?|databases?|tools?|technologies?|platforms?|cloud|devops|reliability|os)\s*:\s*/i;
const SKILL_CATEGORY_ONLY_RE =
  /^(languages?|frameworks?|libraries?|databases?|tools?|technologies?|platforms?|cloud|devops|reliability|os|skills?|proficient)$/i;

const TECH_LINE_RE =
  /^(?:tech(?:nologies?)?|stack|tech\s*stack)\s*[:\-–—]\s*(.+)$/i;

const CONTACT_LABEL_RE =
  /^(contact|contacts|details|candidate\s+details|personal\s+details)$/i;

const MAX_PROJECTS = 30;
const MAX_CERTIFICATIONS = 30;
const MAX_SKILLS = 80;

function extractLocationCandidate(line: string): string | null {
  const value = normalizeWhitespace(line);
  if (!value) return null;
  if (value.includes("|")) {
    const first = normalizeWhitespace(value.split("|")[0] ?? "");
    if (
      looksLikeLocation(first) &&
      !extractEmails(first).length &&
      !extractPhones(first).length
    ) {
      return first;
    }
  }
  if (
    looksLikeLocation(value) &&
    !extractEmails(value).length &&
    !extractPhones(value).length &&
    !/linkedin|github/i.test(value)
  ) {
    return value;
  }
  return null;
}

function scoreNameCandidate(
  line: string,
  neighbors: { prev?: string; next?: string; nearContact: boolean }
): number {
  if (!looksLikeName(line)) return -1;
  if (CONTACT_LABEL_RE.test(normalizeWhitespace(line))) return -1;
  let score = 10;
  if (neighbors.nearContact) score += 4;
  if (neighbors.next && looksLikeHeadline(neighbors.next)) score += 6;
  if (neighbors.next && looksLikeLocation(neighbors.next)) score += 2;
  if (neighbors.prev && CONTACT_LABEL_RE.test(neighbors.prev)) score += 1;
  if (neighbors.next && /^(summary|experience|education|skills|projects)$/i.test(neighbors.next)) {
    score += 3;
  }
  return score;
}

function parseHeaderBlock(
  headerLines: string[],
  allLines: string[],
  fullText: string
): {
  personal: ParsedResumeDraft["personal"];
  headline: string | null;
} {
  const emails = extractEmails(fullText);
  const phones = extractPhones(fullText);
  const linkedins = extractLinkedInUrls(fullText);

  const headerText = headerLines.join("\n");
  const githubs = extractGitHubUrls(headerText);
  const portfolios = extractPortfolioUrls(fullText, {
    headerLines,
    headerOnly: true,
  });

  let fullName: string | null = null;
  let location: string | null = null;
  let headline: string | null = null;
  let nameIndex = -1;

  const scanLines = headerLines.length ? headerLines : allLines.slice(0, 12);

  for (let i = 0; i < Math.min(scanLines.length, 12); i++) {
    const line = scanLines[i]!;
    if (CONTACT_LABEL_RE.test(normalizeWhitespace(line))) continue;
    if (!fullName && looksLikeName(line)) {
      fullName = titleCaseName(line);
      nameIndex = i;
      continue;
    }
    if (!location) {
      const loc = extractLocationCandidate(line);
      if (loc) location = loc;
    }
  }

  // Sidebar / delayed identity: name often appears after CONTACT/SKILLS chrome.
  if (!fullName || CONTACT_LABEL_RE.test(fullName)) {
    let best: { name: string; index: number; score: number } | null = null;
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i]!;
      const prev = allLines[i - 1];
      const next = allLines[i + 1];
      const nearContact =
        Boolean(prev && (extractEmails(prev).length || extractPhones(prev).length)) ||
        Boolean(next && (extractEmails(next).length || extractPhones(next).length)) ||
        Boolean(
          allLines
            .slice(Math.max(0, i - 3), i + 4)
            .some((l) => extractEmails(l).length || extractPhones(l).length || /linkedin/i.test(l))
        );
      const score = scoreNameCandidate(line, { prev, next, nearContact });
      if (score < 0) continue;
      // Prefer name immediately followed by a headline (sidebar body pattern).
      if (!best || score > best.score) {
        best = { name: titleCaseName(line), index: i, score };
      }
    }
    if (best && best.score >= 10) {
      fullName = best.name;
      nameIndex = best.index;
    } else {
      fullName = null;
      nameIndex = -1;
    }
  }

  // Never keep contact chrome as a name via weak fallback.
  if (fullName && CONTACT_LABEL_RE.test(fullName)) {
    fullName = null;
    nameIndex = -1;
  }

  if (!location) {
    for (const line of allLines.slice(0, 40)) {
      const loc = extractLocationCandidate(line);
      if (loc) {
        location = loc;
        break;
      }
    }
  }

  const headlineScan =
    nameIndex >= 0 && nameIndex < allLines.length
      ? allLines.slice(nameIndex + 1, nameIndex + 5)
      : scanLines.slice(0, 6);
  for (const line of headlineScan) {
    if (extractEmails(line).length || extractPhones(line).length) continue;
    if (extractLocationCandidate(line)) continue;
    if (fullName && normalizeWhitespace(line).toLowerCase() === fullName.toLowerCase()) {
      continue;
    }
    if (CONTACT_LABEL_RE.test(normalizeWhitespace(line))) continue;
    // Experience role lines must never become headline (even with job-title signal).
    if (/\s+(?:—|–|-|\bat\b|\b@\b)\s+/i.test(line) && !/[|·]/.test(line)) continue;
    if (looksLikeHeadline(line)) {
      headline = normalizeWhitespace(line);
      break;
    }
  }

  return {
    personal: {
      fullName,
      email: emails[0] ?? null,
      phone: phones[0] ?? null,
      location,
      linkedinUrl: linkedins[0] ?? null,
      githubUrl: githubs[0] ?? null,
      portfolioUrl: portfolios[0] ?? null,
    },
    headline,
  };
}

const COMPANY_SUFFIX_RE =
  /\b(pvt\.?\s*ltd\.?|private\s+limited|ltd\.?|limited|inc\.?|llc|corp\.?|corporation|technologies|technology|systems|solutions|softwares?|labs?|services)\b/i;

/** Project-like titles that must not become employers without job-title evidence. */
const PROJECT_ARTIFACT_RE =
  /\b((?:employee|library|inventory|hospital|school|student|attendance|payroll|recruitment)\s+management(?:\s+system)?|management\s+system|tracking\s+system|final\s+year\s+project|capstone|academic\s+project|personal\s+project|college\s+project|university\s+project|portfolio\s+project|(?:web|mobile)\s+app|website|dashboard|portal)\b/i;

const EDUCATION_ENTITY_RE =
  /\b(university|institute|college|school|polytechnic)\b/i;

/** Trailing segment that is a city/location, not an employer name. */
function looksLikeTrailingRoleLocation(value: string): boolean {
  const loc = normalizeWhitespace(value);
  if (!loc || loc.length > 60) return false;
  if (COMPANY_SUFFIX_RE.test(loc)) return false;
  if (JOB_TITLE_SIGNAL_RE.test(loc)) return false;
  if (
    /\b(infosystems|infotech|consulting|softwares?|technologies|solutions)\b/i.test(
      loc
    )
  ) {
    return false;
  }

  // "City, State/Country" — left side must be a short place name, not "Acme Infosystems".
  const cityState = loc.match(/^([A-Za-z][A-Za-z .'-]{1,40}),\s*([A-Za-z][A-Za-z .'-]{1,40})$/);
  if (cityState) {
    const left = normalizeWhitespace(cityState[1]!);
    if (left.split(/\s+/).length > 2) return false;
    return true;
  }

  return looksLikeLocation(loc);
}

/** Accept trailing city tokens when stripping `Company, City` from role lines. */
function looksLikeCityToken(value: string): boolean {
  const loc = normalizeWhitespace(value);
  if (!loc || loc.length > 40) return false;
  if (COMPANY_SUFFIX_RE.test(loc) || JOB_TITLE_SIGNAL_RE.test(loc)) return false;
  if (
    /\b(infosystems|infotech|consulting|softwares?|technologies|solutions)\b/i.test(
      loc
    )
  ) {
    return false;
  }
  if (looksLikeLocation(loc)) return true;
  const words = loc.split(/\s+/);
  if (words.length < 1 || words.length > 3) return false;
  // Require length >= 4 so bare company codes like "ABC" are not cities.
  if (loc.length < 4) return false;
  return words.every((w) => /^[A-Za-z][A-Za-z'.-]*$/.test(w));
}

/**
 * Parse high-confidence `Title, Company — City` before the generic
 * `left — right` role matcher (which previously set company = City).
 */
function parseTitleCompanyLocationLine(
  line: string
): ParsedResumeExperience | null {
  if (parseDateRange(line)) return null;

  const match = line.match(
    /^(.{2,70}?),\s+(.{2,70}?)\s+(?:—|–|-|\||·)\s+(.{2,60})$/
  );
  if (!match) return null;

  const title = normalizeWhitespace(match[1]!);
  const company = normalizeWhitespace(match[2]!);
  const location = normalizeWhitespace(match[3]!);

  if (title.length < 2 || company.length < 2) return null;
  if (!JOB_TITLE_SIGNAL_RE.test(title)) return null;
  // Location slot: known places OR short bare city tokens (Indore).
  if (!looksLikeTrailingRoleLocation(location) && !looksLikeCityToken(location)) {
    return null;
  }
  // Company side should not itself be a bare city/location.
  if (looksLikeTrailingRoleLocation(company) && !COMPANY_SUFFIX_RE.test(company)) {
    return null;
  }
  if (looksLikeEducationEntity(company) && !COMPANY_SUFFIX_RE.test(company)) {
    return null;
  }
  if (looksLikeProjectArtifact(company) && !COMPANY_SUFFIX_RE.test(company)) {
    return null;
  }

  return {
    title: title
      .replace(
        /\s*\((?:contract|full[- ]?time|part[- ]?time|permanent|temporary|freelance)\)\s*$/i,
        ""
      )
      .trim(),
    company,
    location,
    startDate: null,
    endDate: null,
    isCurrent: false,
    description: null,
  };
}

function looksLikeProjectArtifact(line: string): boolean {
  return PROJECT_ARTIFACT_RE.test(normalizeWhitespace(line));
}

function looksLikeEducationEntity(line: string): boolean {
  const value = normalizeWhitespace(line);
  if (DEGREE_RE.test(value) && !JOB_TITLE_SIGNAL_RE.test(value)) return true;
  if (
    EDUCATION_ENTITY_RE.test(value) &&
    !JOB_TITLE_SIGNAL_RE.test(value) &&
    !COMPANY_SUFFIX_RE.test(value)
  ) {
    return true;
  }
  if (
    /^(computer\s+science|information\s+technology|electronics(?:\s+and\s+communication)?)$/i.test(
      value
    )
  ) {
    return true;
  }
  return false;
}

function looksLikeWeakCompanyLine(line: string): boolean {
  const value = normalizeWhitespace(line);
  if (!value || value.length > 80) return true;
  if (/^[-•*]/.test(value)) return true;
  if (looksLikeJobTitle(value)) return true;
  if (looksLikeLocation(value)) return true;
  if (looksLikeEducationEntity(value)) return true;
  if (looksLikeProjectArtifact(value)) return true;
  if (parseDateRange(value)) return true;
  if (extractEmails(value).length || extractPhones(value).length) return true;
  // Person-name phrase with no org marker is weak as an employer line.
  if (looksLikeName(value) && !COMPANY_SUFFIX_RE.test(value)) return true;
  return false;
}

/**
 * Require job-title evidence on a structured Title—Company / Company—Title line.
 * Rejects project/education masquerades.
 */
function parseStructuredRoleLine(line: string): ParsedResumeExperience | null {
  if (parseDateRange(line)) return null;

  const atMatch = line.match(/^(.{2,80}?)\s+(?:at|@)\s+(.{2,80})$/i);
  if (atMatch) {
    const title = normalizeWhitespace(atMatch[1]!);
    let company = normalizeWhitespace(atMatch[2]!);
    if (!looksLikeJobTitle(title)) return null;
    if (looksLikeName(title)) return null;
    let location: string | null = null;
    const companyCity = company.match(/^(.{2,70}?),\s+(.{2,60})$/);
    if (companyCity) {
      const companyPart = normalizeWhitespace(companyCity[1]!);
      const cityPart = normalizeWhitespace(companyCity[2]!);
      if (looksLikeCityToken(cityPart) && !looksLikeJobTitle(companyPart)) {
        company = companyPart;
        location = cityPart;
      }
    }
    if (looksLikeEducationEntity(company) && !COMPANY_SUFFIX_RE.test(company)) {
      return null;
    }
    if (looksLikeProjectArtifact(company) && !COMPANY_SUFFIX_RE.test(company)) {
      return null;
    }
    if (looksLikeProjectArtifact(title)) return null;
    if (looksLikeLocation(company) && !COMPANY_SUFFIX_RE.test(company)) {
      return null;
    }
    return {
      title,
      company,
      location,
      startDate: null,
      endDate: null,
      isCurrent: false,
      description: null,
    };
  }

  const sepMatch = line.match(/^(.{2,80}?)\s+(?:—|–|-|\||·)\s+(.{2,80})$/);
  if (!sepMatch) return null;

  const left = normalizeWhitespace(sepMatch[1]!);
  const right = normalizeWhitespace(sepMatch[2]!);
  const leftTitle = looksLikeJobTitle(left);
  const rightTitle = looksLikeJobTitle(right);

  if (!leftTitle && !rightTitle) return null;

  let title: string;
  let company: string;
  if (leftTitle && !rightTitle) {
    title = left;
    company = right;
  } else if (rightTitle && !leftTitle) {
    title = right;
    company = left;
  } else {
    // Both look title-like — prefer left as title (Title | Company).
    title = left;
    company = right;
  }

  // `Backend Engineer – Go, Ironpeak Systems` → company = Ironpeak Systems
  const specialtyCompany = company.match(
    /^(Go|Java|Python|PHP|\.?NET|Node\.?js|React|Kotlin|Swift|iOS|Android|AWS|Salesforce|Angular|Ruby)\s*,\s+(.{2,70})$/i
  );
  if (specialtyCompany) {
    company = normalizeWhitespace(specialtyCompany[2]!);
  }

  // Titles must not be person-name phrases; company names often resemble 2–3 word names.
  if (looksLikeName(title)) return null;

  let location: string | null = null;
  // `Title — Company, City, Country`
  const companyCityCountry = company.match(
    /^(.{2,70}?),\s+([A-Za-z][A-Za-z .'-]{1,40}),\s+([A-Za-z][A-Za-z .'-]{1,40})$/
  );
  if (companyCityCountry) {
    const companyPart = normalizeWhitespace(companyCityCountry[1]!);
    const cityPart = normalizeWhitespace(companyCityCountry[2]!);
    const countryPart = normalizeWhitespace(companyCityCountry[3]!);
    if (
      looksLikeCityToken(cityPart) &&
      looksLikeCityToken(countryPart) &&
      !looksLikeTrailingRoleLocation(companyPart) &&
      !looksLikeJobTitle(companyPart)
    ) {
      company = companyPart;
      location = `${cityPart}, ${countryPart}`;
    }
  }

  // `Title — Company, City` (common sparse/junior layout)
  if (!location) {
    const companyCity = company.match(/^(.{2,70}?),\s+(.{2,60})$/);
    if (companyCity) {
      const companyPart = normalizeWhitespace(companyCity[1]!);
      const cityPart = normalizeWhitespace(companyCity[2]!);
      if (
        looksLikeCityToken(cityPart) &&
        !looksLikeTrailingRoleLocation(companyPart) &&
        !looksLikeJobTitle(companyPart)
      ) {
        company = companyPart;
        location = cityPart;
      }
    }
  }

  if (looksLikeTrailingRoleLocation(company) && !COMPANY_SUFFIX_RE.test(company)) {
    return null;
  }
  if (looksLikeEducationEntity(company) && !COMPANY_SUFFIX_RE.test(company)) {
    return null;
  }
  if (looksLikeProjectArtifact(company) && !COMPANY_SUFFIX_RE.test(company)) {
    return null;
  }
  if (looksLikeProjectArtifact(title) && !looksLikeJobTitle(title)) return null;

  title = title
    .replace(
      /\s*\((?:contract|full[- ]?time|part[- ]?time|permanent|temporary|freelance)\)\s*$/i,
      ""
    )
    .trim();

  return {
    title,
    company,
    location,
    startDate: null,
    endDate: null,
    isCurrent: false,
    description: null,
  };
}

function parseExperienceSection(lines: string[]): ParsedResumeExperience[] {
  const experiences: ParsedResumeExperience[] = [];
  let current: ParsedResumeExperience | null = null;
  const descriptionLines: string[] = [];
  /** Title-only line awaiting a credible company line (no Unknown fallback). */
  let pendingTitle: string | null = null;

  const flush = () => {
    if (!current) return;
    if (descriptionLines.length) {
      current.description = descriptionLines.join(" ").trim() || null;
    }
    if (
      current.company &&
      current.title &&
      current.title !== "Unknown" &&
      looksLikeJobTitle(current.title)
    ) {
      experiences.push(current);
    }
    current = null;
    descriptionLines.length = 0;
  };

  const discardPending = () => {
    pendingTitle = null;
  };

  for (const line of lines) {
    const range = parseDateRange(line);
    if (range && current) {
      current.startDate = range.startDate;
      current.endDate = range.endDate;
      current.isCurrent = range.isCurrent;
      continue;
    }

    // Date after a bare title without company — insufficient employment evidence.
    if (range && pendingTitle && !current) {
      discardPending();
      continue;
    }

    const titleCompanyLoc = parseTitleCompanyLocationLine(line);
    if (titleCompanyLoc) {
      flush();
      discardPending();
      current = titleCompanyLoc;
      continue;
    }

    const structured = parseStructuredRoleLine(line);
    if (structured) {
      flush();
      discardPending();
      current = structured;
      continue;
    }

    // Safe two-line form: Job Title \n Company Name (requires job-title signal).
    if (
      !current &&
      !pendingTitle &&
      looksLikeJobTitle(line) &&
      !/^[-•*]/.test(line) &&
      !looksLikeEducationEntity(line) &&
      !looksLikeProjectArtifact(line)
    ) {
      pendingTitle = normalizeWhitespace(line);
      continue;
    }

    if (pendingTitle && !current && !range && !/^[-•*]/.test(line)) {
      if (!looksLikeWeakCompanyLine(line)) {
        flush();
        current = {
          title: pendingTitle,
          company: normalizeWhitespace(line),
          location: null,
          startDate: null,
          endDate: null,
          isCurrent: false,
          description: null,
        };
        discardPending();
        continue;
      }
      // Non-company follow-up (location / name / project) — drop pending title.
      discardPending();
    }

    // Intentionally no "company = line / title = Unknown" fallback (Phase A).

    if (current) {
      const bullet = line.replace(/^[-•*]\s*/, "").trim();
      if (bullet) descriptionLines.push(bullet);
    }
  }

  flush();
  return experiences;
}

/**
 * Prefer explicit Present/current; else most recent open-ended dated role;
 * else null (never invent current from a fully ended history; no [0] guess).
 */
function selectCurrentExperience(
  experiences: ParsedResumeExperience[]
): ParsedResumeExperience | null {
  if (experiences.length === 0) return null;

  const markedCurrent = experiences.find((e) => e.isCurrent);
  if (markedCurrent) return markedCurrent;

  // Open-ended: has start, no end — still employed (not a completed contract).
  const openEnded = experiences.filter((e) => e.startDate && !e.endDate);
  if (openEnded.length === 0) return null;

  const rank = (e: ParsedResumeExperience): number => {
    const start = e.startDate ?? "0000-01-01";
    return Date.parse(start) || 0;
  };

  return [...openEnded].sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

function extractFieldOfStudy(block: string, degree: string | null): string | null {
  const commaDegree = block.match(FIELD_COMMA_DEGREE_RE);
  if (commaDegree?.[1]) {
    const field = normalizeWhitespace(commaDegree[1])
      .replace(/\b(19|20)\d{2}\b/g, "")
      .replace(/\bCGPA\b.*$/i, "")
      .trim();
    if (field.length >= 3 && !DEGREE_RE.test(field) && !EDUCATION_ENTITY_RE.test(field)) {
      return field;
    }
  }
  const inMatch = block.match(FIELD_IN_RE);
  if (inMatch?.[1]) {
    const field = normalizeWhitespace(inMatch[1]).replace(/\b(19|20)\d{2}\b/g, "").trim();
    if (field.length >= 3 && !DEGREE_RE.test(field)) return field;
  }
  const dashMatch = block.match(FIELD_DASH_RE);
  if (dashMatch?.[1]) {
    const field = normalizeWhitespace(dashMatch[1]).replace(/\b(19|20)\d{2}\b/g, "").trim();
    if (field.length >= 3) return field;
  }
  const before = block.match(FIELD_BEFORE_DEGREE_RE);
  if (before?.[1]) {
    const field = normalizeWhitespace(before[1]);
    if (field.length >= 3 && (!degree || !normalizeWhitespace(degree).includes(field))) {
      return field;
    }
  }
  return null;
}

function cleanInstitutionPart(part: string): string {
  return normalizeWhitespace(
    part
      .replace(DEGREE_RE, "")
      .replace(FIELD_COMMA_DEGREE_RE, "")
      .replace(/\b(19|20)\d{2}\b/g, "")
      .replace(/\bCGPA\s*:?\s*[\d.]+(?:\s*\/\s*[\d.]+)?/gi, "")
      .replace(/^[|,\-–—\s]+/, "")
      .replace(/[|,\-–—]+$/g, "")
      .trim()
  );
}

/**
 * Split `Field — University` institution blobs produced by sparse education lines.
 */
function refineInstitutionAndField(
  institution: string,
  field: string | null
): { institution: string; field: string | null } {
  const inst = cleanInstitutionPart(institution);
  const dash = inst.match(/^(.{2,50}?)\s*[—–-]\s*(.{2,80})$/);
  if (dash) {
    const left = normalizeWhitespace(dash[1]!);
    const right = normalizeWhitespace(dash[2]!).replace(/[,|\-–—]+$/g, "").trim();
    const rightLooksInstitution =
      EDUCATION_ENTITY_RE.test(right) ||
      /\b(JNTU|Nirma|Presidency|Fergusson|Osmania|Anna|IIM|NIT|IIT|IIIT|BITS|VJTI)\b/i.test(
        right
      );
    if (
      rightLooksInstitution &&
      !EDUCATION_ENTITY_RE.test(left) &&
      left.length >= 3 &&
      !DEGREE_RE.test(left)
    ) {
      return { institution: right, field: field ?? left };
    }
  }
  return { institution: inst, field };
}

function parseEducationSection(lines: string[]): ParsedResumeEducation[] {
  const educations: ParsedResumeEducation[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const block = buffer.join(" | ");
    buffer = [];

    const yearMatch = block.match(/\b(19|20)\d{2}\b/g);
    const graduationYear = yearMatch
      ? Number(yearMatch[yearMatch.length - 1])
      : null;

    const degreeMatch = block.match(DEGREE_RE);
    const degree = degreeMatch ? degreeMatch[0] : null;
    const field = extractFieldOfStudy(block, degree);

    let institution: string | null = null;
    const parts = block.split("|").map((p) => p.trim()).filter(Boolean);

    // Single-line "Degree, Field, Institution, years" — prefer org-like comma segment.
    if (parts.length === 1 && parts[0]) {
      const segments = parts[0]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const orgSeg = segments.find(
        (s) =>
          EDUCATION_ENTITY_RE.test(s) ||
          /\b(IIM|NIT|IIT|NID|IIIT|BITS|VJTI|PEC|COEP|Anna\s+University|JNTU|Nirma|Presidency|Fergusson|Osmania)\b/i.test(
            s
          )
      );
      if (orgSeg) {
        institution = cleanInstitutionPart(orgSeg);
      }
    }

    // Prefer institution-like parts (college/university/institute) over bare degree lines.
    if (!institution) {
      const ranked = [...parts].sort((a, b) => {
        const score = (p: string) => {
          let s = 0;
          if (EDUCATION_ENTITY_RE.test(p)) s += 5;
          if (DEGREE_RE.test(p) && p.length < 40) s -= 3;
          if (/\b(19|20)\d{2}\b/.test(p)) s += 1;
          s += Math.min(p.length, 40) / 40;
          return s;
        };
        return score(b) - score(a);
      });

      for (const part of ranked) {
        if (DEGREE_RE.test(part) && part.length < 36 && !EDUCATION_ENTITY_RE.test(part)) {
          continue;
        }
        if (/^\d{4}$/.test(part)) continue;
        const cleaned = cleanInstitutionPart(part);
        if (cleaned.length >= 3 && !DEGREE_RE.test(cleaned)) {
          institution = cleaned;
          break;
        }
        if (cleaned.length >= 3) {
          institution = cleaned;
          break;
        }
      }
    }

    if (!institution && degree) {
      const cleaned = cleanInstitutionPart(block);
      institution = cleaned.length >= 3 ? cleaned : null;
    }

    // Require coherent education evidence: institution + (degree or year).
    if (
      institution &&
      (degree || graduationYear) &&
      !CONTACT_LABEL_RE.test(institution)
    ) {
      const refined = refineInstitutionAndField(institution, field);
      if (!refined.institution || refined.institution.length < 3) {
        // skip incoherent institution after refine
      } else {
        educations.push({
          institution: normalizeWhitespace(refined.institution),
          degree: degree ? normalizeWhitespace(degree) : null,
          field: refined.field,
          graduationYear,
        });
      }
    }
  };

  for (const line of lines) {
    const cleaned = line.replace(/^[-•*]\s*/, "");
    if (buffer.length > 0 && DEGREE_RE.test(cleaned)) {
      flush();
    } else if (buffer.length === 0 || /^[-•*]/.test(line)) {
      flush();
    }
    buffer.push(cleaned);
  }
  flush();
  return educations;
}

function parseSkillsSection(lines: string[]): string[] {
  const skills: string[] = [];
  for (const line of lines) {
    let cleaned = line.replace(/^[-•*]\s*/, "").trim();
    cleaned = cleaned.replace(SKILL_CATEGORY_PREFIX_RE, "").trim();
    if (!cleaned || SKILL_CATEGORY_ONLY_RE.test(cleaned)) continue;
    if (isRecruitmentMetadataText(cleaned)) continue;

    const chunks = cleaned
      .split(/[,|•·;/]| and /i)
      .map((s) => normalizeWhitespace(s))
      .filter((s) => s.length >= 1 && s.length <= 40);
    for (const skill of chunks) {
      if (SKILL_CATEGORY_ONLY_RE.test(skill)) continue;
      if (/^(skills?|technologies|proficient)$/i.test(skill)) continue;
      if (isRecruitmentMetadataText(skill)) continue;
      skills.push(skill);
      if (skills.length >= MAX_SKILLS) return skills;
    }
  }
  return skills;
}

function stripTitleUrl(line: string): { title: string; url: string | null } {
  const githubs = extractGitHubProjectUrls(line);
  const generics = extractGenericUrls(line);
  const url = githubs[0] ?? generics[0] ?? null;
  let title = line;
  if (url) {
    title = title
      .replace(url, "")
      .replace(/(?:https?:\/\/)?(?:www\.)?github\.com\/\S+/gi, "")
      .replace(/https?:\/\/\S+/gi, "");
  }
  title = title.replace(/\s*[|·]\s*$/g, "").replace(/^\s*[|·]\s*/, "").trim();
  // title | url  /  title — year already handled elsewhere
  const pipeSplit = title.split(/\s*[|]\s*/);
  if (pipeSplit.length === 2 && /https?:|github\.com/i.test(pipeSplit[1] ?? "")) {
    title = pipeSplit[0]!.trim();
  }
  return { title: normalizeWhitespace(title), url };
}

function looksLikeProjectTitle(line: string): boolean {
  if (!line || line.length > 100) return false;
  if (/^[-•*]/.test(line)) return false;
  if (TECH_LINE_RE.test(line)) return false;
  if (parseDateRange(line) && line.length < 40) return false;
  if (/^\d{4}$/.test(line.trim())) return false;
  if (CONTACT_LABEL_RE.test(normalizeWhitespace(line))) return false;
  if (/^(candidate\s+details|languages?|notice\s+period|certifications?)$/i.test(line)) {
    return false;
  }
  if (isRecruitmentMetadataText(line)) return false;
  // Description sentences / wrap fragments that leaked into project blocks.
  if (/^[a-z]/.test(line)) return false;
  if (/\.\s*$/.test(line) && /\s/.test(line)) return false;
  if (/;\s*/.test(line)) return false;
  if (
    /\b(recommending|based on|available on|portfolio at|cutting |caught |flags |letting |uses |built using|end-to-end pipeline|in-app purchase|downloads)\b/i.test(
      line
    )
  ) {
    return false;
  }
  if (
    /^(built|developed|created|implemented|led|designed|wrote|own|reduced|assisted|supported|personal|side\s+project|writes)\b/i.test(
      line
    ) &&
    line.split(/\s+/).length >= 4
  ) {
    return false;
  }
  if (looksLikeJobTitle(line) && /—|–|\bat\b|\b@\b/i.test(line)) return false;
  return true;
}

function parseProjectsSection(lines: string[]): ParsedResumeProject[] {
  const projects: ParsedResumeProject[] = [];
  let current: ParsedResumeProject | null = null;
  const summaryLines: string[] = [];

  const flush = () => {
    if (!current?.title) {
      current = null;
      summaryLines.length = 0;
      return;
    }
    if (summaryLines.length) {
      current.summary = summaryLines.join(" ").trim() || null;
    }
    projects.push(current);
    current = null;
    summaryLines.length = 0;
  };

  for (const line of lines) {
    const techMatch = line.match(TECH_LINE_RE);
    if (techMatch && current) {
      current.techStack = normalizeWhitespace(techMatch[1]!);
      continue;
    }

    const range = parseDateRange(line);
    if (range && current && line.length <= 60) {
      current.duration = normalizeWhitespace(range.raw);
      continue;
    }

    const yearOnly = line.trim().match(/^(?:—|–|-)?\s*((?:19|20)\d{2})\s*$/);
    if (yearOnly && current && !current.duration) {
      current.duration = yearOnly[1]!;
      continue;
    }

    const bullet = /^[-•*]\s*(.+)$/.exec(line);
    if (bullet && current) {
      summaryLines.push(bullet[1]!.trim());
      continue;
    }

    if (looksLikeProjectTitle(line)) {
      flush();
      const { title, url } = stripTitleUrl(line);
      // title — 2024
      const titleYear = title.match(/^(.{2,80}?)\s*[—–-]\s*((?:19|20)\d{2})$/);
      let finalTitle = title;
      let duration: string | null = null;
      if (titleYear) {
        finalTitle = normalizeWhitespace(titleYear[1]!);
        duration = titleYear[2]!;
      }
      if (!finalTitle || finalTitle.length < 2) continue;
      // Strip trailing tech parentheses: "Chaos Testing Framework (Python, K8s)"
      finalTitle = finalTitle.replace(/\s*\([^)]{3,60}\)\s*$/g, "").trim();
      if (!finalTitle || finalTitle.length < 2) continue;
      if (CONTACT_LABEL_RE.test(finalTitle)) continue;
      current = {
        title: finalTitle,
        summary: null,
        techStack: null,
        url,
        duration,
      };
      continue;
    }

    if (current) {
      const plain = line.replace(/^[-•*]\s*/, "").trim();
      if (plain) summaryLines.push(plain);
    }
  }

  flush();
  return projects.slice(0, MAX_PROJECTS);
}

function certificationFromParts(
  parts: string[],
  credentialUrl: string | null
): ParsedResumeCertification | null {
  let name: string | null = null;
  let issuer: string | null = null;
  let issuedAt: string | null = null;
  let credentialId: string | null = null;

  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    if (/^https?:/i.test(part)) continue;
    if (/^(?:19|20)\d{2}$/.test(part) || normalizeResumeDate(part)) {
      issuedAt = normalizeResumeDate(part) ?? `${part.replace(/\D/g, "").slice(0, 4)}-01-01`;
      continue;
    }
    if (/^(id|credential)\s*[:#]/i.test(part)) {
      credentialId = part.replace(/^(id|credential)\s*[:#]\s*/i, "").trim();
      continue;
    }
    if (!name) {
      name = part;
      continue;
    }
    if (!issuer) {
      issuer = part;
    }
  }

  if (name && !issuedAt) {
    const yearInName = name.match(/\b((?:19|20)\d{2})\b/);
    if (yearInName) {
      issuedAt = `${yearInName[1]}-01-01`;
      name = name.replace(/\b(?:19|20)\d{2}\b/g, "").replace(/[—–|,]+$/g, "").trim();
    }
  }

  if (name) name = name.replace(/https?:\/\/\S+/gi, "").trim();
  if (!name || name.length < 2) return null;
  // Drop compensation/joining/availability metadata and "Additional Info" rows.
  if (isRecruitmentMetadataText(name)) return null;
  if (/^additional\s+(info|information)$/i.test(name)) return null;
  if (/^available\b/i.test(name)) return null;
  if (issuer && isRecruitmentMetadataText(issuer)) return null;

  return {
    name: normalizeWhitespace(name),
    issuer: issuer ? normalizeWhitespace(issuer) : null,
    issuedAt,
    credentialUrl,
    credentialId,
  };
}

function parseCertificationsSection(lines: string[]): ParsedResumeCertification[] {
  const certs: ParsedResumeCertification[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const blockLines = buffer;
    buffer = [];
    const joined = blockLines.join(" | ");
    const urls = extractGenericUrls(joined);
    const credentialUrl = urls[0] ?? null;

    let parsed: ParsedResumeCertification | null = null;
    if (/[|—–]/.test(joined)) {
      parsed = certificationFromParts(
        joined.split(/\s*[|—–]\s*/),
        credentialUrl
      );
    } else {
      parsed = certificationFromParts(blockLines, credentialUrl);
    }
    if (parsed) certs.push(parsed);
  };

  for (const line of lines) {
    const cleaned = line.replace(/^[-•*]\s*/, "").trim();
    if (!cleaned) continue;
    if (isRecruitmentMetadataText(cleaned)) continue;
    if (/^additional\s+(info|information)$/i.test(cleaned)) continue;

    // Single-line structured cert — emit immediately.
    if (/\s(?:[|—–])\s/.test(cleaned) || /[|—–].*[|—–]/.test(cleaned)) {
      flush();
      const urls = extractGenericUrls(cleaned);
      const parsed = certificationFromParts(
        cleaned.split(/\s*[|—–]\s*/),
        urls[0] ?? null
      );
      if (parsed) certs.push(parsed);
      continue;
    }

    const isYearOnly =
      /^(?:19|20)\d{2}$/.test(cleaned) || !!normalizeResumeDate(cleaned);
    const isUrlOnly = /^https?:\/\//i.test(cleaned);
    const isMeta =
      isYearOnly || isUrlOnly || /^(id|credential)\s*[:#]/i.test(cleaned);

    if (!isMeta && buffer.length >= 1) {
      const prev = buffer.join(" ");
      const prevComplete =
        buffer.length >= 2 ||
        /\b(?:19|20)\d{2}\b/.test(prev) ||
        /[|—–]/.test(buffer[0] ?? "");
      if (prevComplete) flush();
    }

    buffer.push(cleaned);
  }
  flush();
  return certs.slice(0, MAX_CERTIFICATIONS);
}

/**
 * Deterministic section/header parser — no AI.
 * Operates on already-extracted plain text.
 */
export function parseResumeFromCleanText(text: string): {
  draft: ParsedResumeDraft;
  warnings: string[];
} {
  const warnings: string[] = [];
  const draft = EMPTY_PARSED_RESUME_DRAFT();

  if (!text || !text.trim()) {
    warnings.push("No extractable text found (scanned PDFs are not supported).");
    return { draft, warnings };
  }

  const lines = splitResumeLines(text);
  const { headerLines, sections } = detectResumeSections(lines);
  const header = parseHeaderBlock(
    headerLines.length ? headerLines : lines.slice(0, 10),
    lines,
    text
  );

  draft.personal = header.personal;
  draft.professional.headline = header.headline;

  if (sections.summary.length) {
    draft.professional.summary = sections.summary.join(" ").trim();
  }

  draft.experiences = parseExperienceSection(sections.experience);
  if (draft.experiences.length === 0 && sections.experience.length > 0) {
    warnings.push(
      "Experience section found but no structured roles could be extracted."
    );
  }

  const current = selectCurrentExperience(draft.experiences);
  if (current) {
    draft.professional.currentCompany = current.company;
    draft.professional.currentTitle =
      current.title === "Unknown" ? null : current.title;
  }

  draft.educations = parseEducationSection(sections.education);
  draft.skills = parseSkillsSection(sections.skills);
  draft.projects = parseProjectsSection(sections.projects);
  draft.certifications = parseCertificationsSection(sections.certifications);
  draft.professional.totalExperienceYears = extractYearsOfExperience(text);

  if (!draft.personal.fullName) warnings.push("Could not detect full name.");
  if (!draft.personal.email) warnings.push("Could not detect email.");
  if (sections.experience.length === 0) {
    warnings.push("No experience section detected.");
  }
  if (sections.education.length === 0) {
    warnings.push("No education section detected.");
  }
  if (sections.skills.length === 0) {
    warnings.push("No skills section detected.");
  }

  return { draft, warnings };
}
