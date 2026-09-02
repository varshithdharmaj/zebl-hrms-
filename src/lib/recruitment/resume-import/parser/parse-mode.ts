/**
 * Resume parsing strategy selector.
 *
 * - `"llm"` (default, Phase 3): single-pass — raw PDF/DOCX sent directly to Gemini,
 *   returning candidate fields, aiInsights, and extractionMeta in one response.
 * - `"deterministic"`: legacy regex/heuristic parser. Opt-in rollback only —
 *   set `RESUME_PARSE_MODE=deterministic` to disable single-pass parsing.
 *
 * Controlled via the `RESUME_PARSE_MODE` environment variable.
 * Server-only — never exposed to the client.
 */

export type ResumeParseMode = "deterministic" | "llm";

export function getResumeParseMode(): ResumeParseMode {
  const raw = process.env.RESUME_PARSE_MODE?.trim().toLowerCase();
  if (raw === "deterministic") return "deterministic";
  return "llm";
}
