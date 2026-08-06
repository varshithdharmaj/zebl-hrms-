/** Text cleanup helpers for deterministic resume parsing. */

export function cleanupResumeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function splitResumeLines(text: string): string[] {
  return cleanupResumeText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function titleCaseName(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      if (part.includes("-")) {
        return part
          .split("-")
          .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : p))
          .join("-");
      }
      return part[0]!.toUpperCase() + part.slice(1);
    })
    .join(" ");
}
