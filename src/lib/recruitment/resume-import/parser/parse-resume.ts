import { splitResumeLines, titleCaseName, normalizeWhitespace } from "./cleanup";
import {
  extractEmails,
  extractLinkedInUrls,
  extractPhones,
  extractYearsOfExperience,
  looksLikeLocation,
  looksLikeName,
  parseDateRange,
} from "./patterns";
import { detectResumeSections } from "./sections";
import type {
  ParsedResumeDraft,
  ParsedResumeEducation,
  ParsedResumeExperience,
} from "./types";
import { EMPTY_PARSED_RESUME_DRAFT } from "./types";

const DEGREE_RE =
  /\b(B\.?Tech|B\.?E\.?|B\.?Sc|B\.?S\.?|B\.?A\.?|M\.?Tech|M\.?S\.?|M\.?Sc|M\.?B\.?A\.?|MBA|Ph\.?D\.?|Bachelor|Master|Diploma|Associate)\b/i;

function parseHeaderBlock(
  lines: string[],
  fullText: string
): ParsedResumeDraft["personal"] {
  const emails = extractEmails(fullText);
  const phones = extractPhones(fullText);
  const linkedins = extractLinkedInUrls(fullText);

  let fullName: string | null = null;
  let location: string | null = null;

  for (const line of lines.slice(0, 8)) {
    if (!fullName && looksLikeName(line)) {
      fullName = titleCaseName(line);
      continue;
    }
    if (!location && looksLikeLocation(line) && !extractEmails(line).length) {
      location = normalizeWhitespace(line);
    }
  }

  if (!fullName) {
    for (const line of lines.slice(0, 5)) {
      if (extractEmails(line).length || extractPhones(line).length) continue;
      if (/linkedin|http/i.test(line)) continue;
      if (line.length >= 3 && line.length <= 60) {
        fullName = titleCaseName(line);
        break;
      }
    }
  }

  return {
    fullName,
    email: emails[0] ?? null,
    phone: phones[0] ?? null,
    location,
    linkedinUrl: linkedins[0] ?? null,
  };
}

function parseExperienceSection(lines: string[]): ParsedResumeExperience[] {
  const experiences: ParsedResumeExperience[] = [];
  let current: ParsedResumeExperience | null = null;
  const descriptionLines: string[] = [];

  const flush = () => {
    if (!current) return;
    if (descriptionLines.length) {
      current.description = descriptionLines.join(" ").trim() || null;
    }
    if (current.company && current.title && current.title !== "Unknown") {
      experiences.push(current);
    }
    current = null;
    descriptionLines.length = 0;
  };

  for (const line of lines) {
    const range = parseDateRange(line);
    if (range && current) {
      current.startDate = range.startDate;
      current.endDate = range.endDate;
      current.isCurrent = range.isCurrent;
      continue;
    }

    const roleCompany = line.match(
      /^(.{2,80}?)\s+(?:at|@|—|–|-|\||·)\s+(.{2,80})$/i
    );
    if (roleCompany && !parseDateRange(line)) {
      flush();
      current = {
        title: normalizeWhitespace(roleCompany[1]!),
        company: normalizeWhitespace(roleCompany[2]!),
        startDate: null,
        endDate: null,
        isCurrent: false,
        description: null,
      };
      continue;
    }

    if (!current && line.length <= 80 && !/^[-•*]/.test(line)) {
      flush();
      current = {
        title: "Unknown",
        company: normalizeWhitespace(line),
        startDate: null,
        endDate: null,
        isCurrent: false,
        description: null,
      };
      continue;
    }

    if (current && current.title === "Unknown" && !/^[-•*]/.test(line) && !range) {
      current.title = normalizeWhitespace(line);
      continue;
    }

    if (current) {
      const bullet = line.replace(/^[-•*]\s*/, "").trim();
      if (bullet) descriptionLines.push(bullet);
    }
  }

  flush();
  return experiences;
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

    let institution: string | null = null;
    for (const part of block.split("|").map((p) => p.trim())) {
      if (DEGREE_RE.test(part) && part.length < 48) continue;
      if (/^\d{4}$/.test(part)) continue;
      if (part.length >= 3) {
        institution = part
          .replace(/\b(19|20)\d{2}\b/g, "")
          .replace(/[|,\-–—]+$/g, "")
          .trim();
        if (institution) break;
      }
    }

    if (!institution && degree) {
      institution =
        block
          .replace(DEGREE_RE, "")
          .replace(/\b(19|20)\d{2}\b/g, "")
          .trim() || "Unknown Institution";
    }

    if (institution) {
      educations.push({
        institution: normalizeWhitespace(institution),
        degree: degree ? normalizeWhitespace(degree) : null,
        graduationYear,
      });
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
    const chunks = line
      .replace(/^[-•*]\s*/, "")
      .split(/[,|•·;/]| and /i)
      .map((s) => normalizeWhitespace(s))
      .filter((s) => s.length >= 1 && s.length <= 40);
    for (const skill of chunks) {
      if (/^(skills?|technologies|proficient)$/i.test(skill)) continue;
      skills.push(skill);
    }
  }
  return skills;
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
    text
  );

  draft.personal = header;

  if (sections.summary.length) {
    draft.professional.summary = sections.summary.join(" ").trim();
  }

  draft.experiences = parseExperienceSection(sections.experience);
  if (draft.experiences.length === 0 && sections.experience.length > 0) {
    warnings.push(
      "Experience section found but no structured roles could be extracted."
    );
  }

  const current =
    draft.experiences.find((e) => e.isCurrent) ?? draft.experiences[0];
  if (current) {
    draft.professional.currentCompany = current.company;
    draft.professional.currentTitle =
      current.title === "Unknown" ? null : current.title;
  }

  draft.educations = parseEducationSection(sections.education);
  draft.skills = parseSkillsSection(sections.skills);
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
