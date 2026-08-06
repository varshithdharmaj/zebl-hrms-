import "server-only";

import { cleanupResumeText } from "./cleanup";
import { extractResumeText } from "./extract-text";
import { normalizeParsedResumeDraft } from "./normalize";
import { parseResumeFromCleanText } from "./parse-resume";
import { draftContentFromParsed } from "./to-draft-content";
import {
  EMPTY_PARSED_RESUME_DRAFT,
  RESUME_PARSER_VERSION,
  type ResumeParseResult,
} from "./types";
import type { ResumeImportDraftContent } from "@/lib/recruitment/resume-import/types";

export type { ResumeParseResult, ResumeParserError, ParsedResumeDraft } from "./types";
export { RESUME_PARSER_VERSION, EMPTY_PARSED_RESUME_DRAFT } from "./types";
export { detectResumeDocumentKind, extractResumeText } from "./extract-text";
export { parseResumeFromCleanText } from "./parse-resume";
export { normalizeParsedResumeDraft } from "./normalize";
export { mappedDraftFromParsed, draftContentFromParsed } from "./to-draft-content";
export {
  extractEmails,
  extractPhones,
  extractLinkedInUrls,
  normalizeResumeDate,
  normalizePhone,
} from "./patterns";

/**
 * Full pipeline:
 * Document bytes → text extract → cleanup → parse → normalize → draft content
 *
 * Pure aside from library extractors. Does not write to the database.
 *
 * Future AI extension point:
 *   After `parseResumeFromCleanText`, optionally call an AI enricher that
 *   returns Partial<ParsedResumeDraft>, then merge before normalize.
 *   Keep extract + normalize + draftContentFromParsed unchanged.
 */
export async function parseResumeDocument(input: {
  content: Buffer | Uint8Array;
  fileName: string;
  mimeType: string;
  documentId?: string | null;
}): Promise<{
  result: ResumeParseResult;
  draftContent: ResumeImportDraftContent;
}> {
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
          "No text could be extracted. Scanned image PDFs are not supported in V1.",
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
        documentId: input.documentId ?? null,
        warnings,
        rawTextLength: cleaned.length,
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

/** Parse from plain text only (unit tests / future adapters). */
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
