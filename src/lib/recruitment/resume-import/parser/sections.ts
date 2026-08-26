import { normalizeWhitespace } from "./cleanup";

export type ResumeSectionId =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "other";

const SECTION_HEADERS: Array<{ id: ResumeSectionId; patterns: RegExp[] }> = [
  {
    id: "summary",
    patterns: [
      /^(professional\s+)?summary$/i,
      /^career\s+summary$/i,
      /^career\s+profile$/i,
      /^professional\s+profile$/i,
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
      /^career\s+timeline$/i,
      /^relevant\s+experience$/i,
      /^internship\s+experience$/i,
      /^internships?$/i,
      /^professional\s+journey$/i,
      /^experience\s+snapshot$/i,
      /^where\s+i'?ve\s+(worked|been)$/i,
    ],
  },
  {
    id: "education",
    patterns: [
      /^education$/i,
      /^academic(\s+background)?$/i,
      /^academic\s+history$/i,
      /^academics?$/i,
      /^qualifications?$/i,
      /^educational\s+background$/i,
      /^education\s*(?:&|and)\s*qualifications?$/i,
      /^education\s+details$/i,
      /^academic\s+qualifications?$/i,
      /^school$/i,
      /^learning$/i,
    ],
  },
  {
    id: "skills",
    patterns: [
      /^(technical\s+)?skills$/i,
      /^core\s+skills$/i,
      /^core\s+competenc(y|ies)$/i,
      /^competenc(y|ies)$/i,
      /^technologies$/i,
      /^tech\s+stack$/i,
      /^tools\s*(?:&|and)\s*technologies$/i,
      /^key\s+skills$/i,
      /^toolbox$/i,
      /^tools$/i,
      /^skill\s+set$/i,
      /^stack$/i,
      /^platform\s+skills$/i,
      /^toolkit$/i,
    ],
  },
  {
    id: "projects",
    patterns: [
      /^projects?$/i,
      /^(personal|academic|selected|key|technical|relevant|notable)\s+projects?$/i,
      /^key\s+initiatives?$/i,
      /^things\s+i'?ve\s+built$/i,
      /^things\s+i\s+built$/i,
      /^selected\s+work$/i,
      /^builds$/i,
    ],
  },
  {
    id: "certifications",
    patterns: [
      /^certifications?$/i,
      /^certificates?$/i,
      /^licenses?$/i,
      /^professional\s+certifications?$/i,
      /^courses?\s*(?:&|and)\s*certifications?$/i,
      /^licenses?\s*(?:&|and)\s*certifications?$/i,
      /^credentials?$/i,
    ],
  },
];

const IGNORE_HEADERS = [
  /^awards?$/i,
  /^achievements?$/i,
  /^languages?$/i,
  /^publications?$/i,
  /^references?$/i,
  /^volunteer/i,
  /^interests?$/i,
  /^hobbies$/i,
  // Sidebar / contact chrome — not identity content for section routing
  /^contacts?$/i,
  /^candidate\s+details$/i,
  /^personal\s+details$/i,
  // Non-recruitment metadata blocks (must not feed skills/certs/etc.)
  /^additional\s+(info|information)$/i,
  /^personal\s+information$/i,
  /^other\s+information$/i,
  /^availability$/i,
  /^compensation$/i,
  /^salary(\s+details)?$/i,
  /^notice\s+period$/i,
  /^declaration$/i,
];

export function matchSectionHeader(line: string): ResumeSectionId | "ignore" | null {
  const raw = normalizeWhitespace(line);
  const cleaned = raw.replace(/[:\-–—]+$/, "").trim();
  if (!cleaned || cleaned.length > 40) return null;

  // "Languages:" / "Frameworks:" inside Skills are category labels, not section headers.
  const looksLikeCategoryLabel =
    /:\s*$/.test(raw) && cleaned.split(/\s+/).length <= 3;

  if (!looksLikeCategoryLabel) {
    for (const re of IGNORE_HEADERS) {
      if (re.test(cleaned)) return "ignore";
    }
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
  /** False when no recognizable section heading appeared anywhere in the document. */
  hasAnySectionHeader: boolean;
} {
  const sections: SectionMap = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
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

  return { headerLines, sections, hasAnySectionHeader: seenSection };
}
