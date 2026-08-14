import "server-only";

import { cleanupResumeText } from "./cleanup";
import { extractResumeText } from "./extract-text";
import { normalizeParsedResumeDraft } from "./normalize";
import { parseResumeFromCleanText } from "./parse-resume";
import { draftContentFromParsed } from "./to-draft-content";
import {
  EMPTY_PARSED_RESUME_DRAFT,
  type ResumeParseResult,
} from "./types";
import type { ResumeImportDraftContent } from "@/lib/recruitment/resume-import/types";
import { runSemanticVerificationPipeline } from "../semantic";
import type { SemanticVerifyGenerator } from "../semantic/llm-verify";
import { getResumeParseMode } from "./parse-mode";
import { parseResumeWithLlm, type LlmResumeGenerator } from "./llm-parse-resume";
import { logger } from "@/lib/observability/logger";

export type { ResumeParseResult, ResumeParserError, ParsedResumeDraft } from "./types";
export { RESUME_PARSER_VERSION, EMPTY_PARSED_RESUME_DRAFT } from "./types";
export { detectResumeDocumentKind, extractResumeText } from "./extract-text";
export {
  reconstructPdfTextFromItems,
  shouldUsePositionalPdfReconstruction,
} from "./pdf-line-reconstruct";
export { isRecruitmentMetadataText } from "./recruitment-metadata";
export { parseResumeFromCleanText } from "./parse-resume";
export { normalizeParsedResumeDraft } from "./normalize";
export { mappedDraftFromParsed, draftContentFromParsed } from "./to-draft-content";
export {
  extractEmails,
  extractPhones,
  extractLinkedInUrls,
  extractGitHubUrls,
  extractPortfolioUrls,
  normalizeResumeDate,
  normalizePhone,
} from "./patterns";
export { matchSectionHeader, detectResumeSections } from "./sections";
export { getResumeParseMode } from "./parse-mode";

/**
 * Full pipeline:
 * Document bytes → text extract → cleanup → parse → normalize
 * → optional selective semantic verification → draft content
 *
 * When RESUME_PARSE_MODE=llm, skips the deterministic parser and sends
 * the complete extracted text directly to the LLM for structured extraction.
 *
 * Does not write to the database. Candidate remains Source of Truth via HR review.
 */
export async function parseResumeDocument(input: {
  content: Buffer | Uint8Array;
  fileName: string;
  mimeType: string;
  documentId?: string | null;
  /** Default false. Opt-in only via `true` or RESUME_SEMANTIC_VERIFY=1. */
  semanticVerification?: boolean;
  /** Test seam for Gemini semantic verification. */
  semanticGenerate?: SemanticVerifyGenerator;
  /** Test seam for LLM resume parser Gemini call. */
  llmGenerate?: LlmResumeGenerator;
}): Promise<{
  result: ResumeParseResult;
  draftContent: ResumeImportDraftContent;
}> {
  const parseMode = getResumeParseMode();

  // --- LLM path: send original uploaded PDF/DOCX file directly to Gemini ---
  if (parseMode === "llm") {
    logger.info("recruitment.resume.parse_mode", {
      entityType: "resume",
      parseMode: "llm",
      fileName: input.fileName,
      mimeType: input.mimeType,
    });
    return parseResumeWithLlm(
      {
        content: input.content,
        fileName: input.fileName,
        mimeType: input.mimeType,
        documentId: input.documentId ?? null,
      },
      { generate: input.llmGenerate }
    );
  }

  // --- Deterministic path (default): existing cleanup → parse → normalize flow ---
  const extracted = await extractResumeText({
    content: input.content,
    fileName: input.fileName,
    mimeType: input.mimeType,
  });

  if (!extracted.ok) {
    const empty = EMPTY_PARSED_RESUME_DRAFT();
    const result: ResumeParseResult = {
      ok: false,
      error: extracted.error,
      draft: empty,
      warnings: [extracted.error.message],
    };
    return {
      result,
      draftContent: draftContentFromParsed({
        draft: empty,
        documentId: input.documentId ?? null,
        warnings: result.warnings,
        rawTextLength: 0,
        errorNote: extracted.error.message,
      }),
    };
  }

  const cleaned = cleanupResumeText(extracted.extraction.text);
  if (!cleaned) {
    const empty = EMPTY_PARSED_RESUME_DRAFT();
    const result: ResumeParseResult = {
      ok: false,
      error: {
        code: "EMPTY_DOCUMENT",
        message:
          "No text could be extracted. Scanned image PDFs are not supported.",
      },
      draft: empty,
      warnings: ["Empty extractable text."],
    };
    return {
      result,
      draftContent: draftContentFromParsed({
        draft: empty,
        documentId: input.documentId ?? null,
        warnings: result.warnings,
        rawTextLength: 0,
        errorNote: result.error.message,
      }),
    };
  }

  try {
    const { draft: rawDraft, warnings } = parseResumeFromCleanText(cleaned);
    let draft = normalizeParsedResumeDraft(rawDraft);

    const semanticEnabled =
      input.semanticVerification === true ||
      process.env.RESUME_SEMANTIC_VERIFY === "1";
    const semantic = await runSemanticVerificationPipeline({
      draft,
      cleanedText: cleaned,
      warnings,
      skipLlm: !semanticEnabled,
      generate: input.semanticGenerate,
    });
    draft = semantic.draft;

    const result: ResumeParseResult = {
      ok: true,
      draft,
      warnings,
      rawTextLength: cleaned.length,
    };
    return {
      result,
      draftContent: draftContentFromParsed({
        draft,
        documentId: input.documentId ?? null,
        warnings,
        rawTextLength: cleaned.length,
        semanticVerification: {
          attempted: semantic.meta.attempted,
          skipped: semantic.meta.skipped,
          skipReason: semantic.meta.skipReason,
          ambiguityReasons: semantic.meta.ambiguityReasons,
          llmSuccess: semantic.meta.llmSuccess,
          llmError: semantic.meta.llmError,
          decisionCount: semantic.meta.decisionCount,
          accepted: semantic.meta.accepted,
          rejected: semantic.meta.rejected,
          unsupported: semantic.meta.unsupported,
          fallbackDeterministic: semantic.meta.fallbackDeterministic,
          modelId: semantic.meta.modelId,
        },
      }),
    };
  } catch (err) {
    const empty = EMPTY_PARSED_RESUME_DRAFT();
    const message =
      err instanceof Error ? err.message : "Unexpected parser failure.";
    const result: ResumeParseResult = {
      ok: false,
      error: { code: "PARSE_FAILED", message, details: message },
      draft: empty,
      warnings: [message],
    };
    return {
      result,
      draftContent: draftContentFromParsed({
        draft: empty,
        documentId: input.documentId ?? null,
        warnings: result.warnings,
        rawTextLength: cleaned.length,
        errorNote: message,
      }),
    };
  }
}

/**
 * Parse from plain text only (unit tests / adapters).
 * Deterministic only — does not call LLM (keeps tests fast/offline).
 */
export function parseResumePlainText(
  text: string,
  documentId: string | null = null
): {
  result: ResumeParseResult;
  draftContent: ResumeImportDraftContent;
} {
  const cleaned = cleanupResumeText(text);
  if (!cleaned) {
    const empty = EMPTY_PARSED_RESUME_DRAFT();
    const result: ResumeParseResult = {
      ok: false,
      error: {
        code: "EMPTY_DOCUMENT",
        message: "Resume text is empty.",
      },
      draft: empty,
      warnings: ["Empty resume text."],
    };
    return {
      result,
      draftContent: draftContentFromParsed({
        draft: empty,
        documentId,
        warnings: result.warnings,
        rawTextLength: 0,
        errorNote: result.error.message,
      }),
    };
  }

  const { draft: rawDraft, warnings } = parseResumeFromCleanText(cleaned);
  const draft = normalizeParsedResumeDraft(rawDraft);
  const result: ResumeParseResult = {
    ok: true,
    draft,
    warnings,
    rawTextLength: cleaned.length,
  };
  return {
    result,
    draftContent: draftContentFromParsed({
      draft,
      documentId,
      warnings,
      rawTextLength: cleaned.length,
    }),
  };
}
