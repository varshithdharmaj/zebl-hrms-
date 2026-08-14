/**
 * Resume parsing strategy selector.
 *
 * - `"deterministic"` (default): existing regex/heuristic parser (Phase A+).
 * - `"llm"`: send complete extracted text to Gemini for structured extraction (experimental).
 *
 * Controlled via the `RESUME_PARSE_MODE` environment variable.
 * Server-only — never exposed to the client.
 */

export type ResumeParseMode = "deterministic" | "llm";

export function getResumeParseMode(): ResumeParseMode {
  const raw = process.env.RESUME_PARSE_MODE?.trim().toLowerCase();
  if (raw === "llm") return "llm";
  return "deterministic";
}
