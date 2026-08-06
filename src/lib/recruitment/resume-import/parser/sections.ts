import { normalizeWhitespace } from "./cleanup";

export type ResumeSectionId =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "other";

const SECTION_HEADERS: Array<{ id: ResumeSectionId; patterns: RegExp[] }> = [
  {
    id: "summary",
    patterns: [
      /^(professional\s+)?summary$/i,
      /^profile$/i,
      /^about(\s+me)?$/i,
      /^objective$/i,
      /^career\s+objective$/i,
    ],
  },
  {
    id: "experience",
    patterns: [
      /^(work\s+)?experience$/i,
      /^employment(\s+history)?$/i,
      /^professional\s+experience$/i,
      /^work\s+history$/i,
      /^career(\s+history)?$/i,
    ],
  },
  {
    id: "education",
    patterns: [
      /^education$/i,
      /^academic(\s+background)?$/i,
      /^qualifications?$/i,
      /^educational\s+background$/i,
    ],
  },
  {
    id: "skills",
    patterns: [
      /^(technical\s+)?skills$/i,
      /^core\s+competenc(y|ies)$/i,
      /^technologies$/i,
      /^tech\s+stack$/i,
      /^key\s+skills$/i,
    ],
  },
];

const IGNORE_HEADERS = [
  /^certifications?$/i,
  /^awards?$/i,
  /^languages?$/i,
  /^projects?$/i,
  /^publications?$/i,
  /^references?$/i,
  /^volunteer/i,
  /^interests?$/i,
  /^hobbies$/i,
];

export function matchSectionHeader(line: string): ResumeSectionId | "ignore" | null {
  const cleaned = normalizeWhitespace(line).replace(/[:\-–—]+$/, "").trim();
  if (!cleaned || cleaned.length > 40) return null;

  for (const re of IGNORE_HEADERS) {
    if (re.test(cleaned)) return "ignore";
  }
  for (const section of SECTION_HEADERS) {
    if (section.patterns.some((re) => re.test(cleaned))) return section.id;
  }
  return null;
}

export type SectionMap = Record<ResumeSectionId, string[]>;

export function detectResumeSections(lines: string[]): {
  headerLines: string[];
  sections: SectionMap;
} {
  const sections: SectionMap = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    other: [],
  };

  const headerLines: string[] = [];
  let current: ResumeSectionId | "ignore" | null = null;
  let seenSection = false;

  for (const line of lines) {
    const header = matchSectionHeader(line);
    if (header) {
      seenSection = true;
      current = header;
      continue;
    }

    if (!seenSection) {
      headerLines.push(line);
      continue;
    }

    if (current === "ignore" || current === null) {
      sections.other.push(line);
      continue;
    }
    sections[current].push(line);
  }

  return { headerLines, sections };
}
