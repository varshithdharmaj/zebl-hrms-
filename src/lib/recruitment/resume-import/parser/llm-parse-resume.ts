import "server-only";

/**
 * Direct LLM resume parsing service.
 *
 * Sends the original PDF/DOCX document directly to Gemini via inlineData (base64)
 * and validates the structured response with Zod. Returns the same `{ result, draftContent }`
 * shape as `parseResumeDocument` so the merge/review flow works unchanged.
 *
 * Does NOT write to the database.
 */

import { getGeminiApiKey, getGeminiModel } from "@/lib/recruitment/ai/config";
import { logger } from "@/lib/observability/logger";
import type { ResumeImportDraftContent } from "@/lib/recruitment/resume-import/types";
import type { ResumeParseResult } from "./types";
import { EMPTY_PARSED_RESUME_DRAFT } from "./types";
import {
  RESUME_INTELLIGENCE_SYSTEM_PROMPT,
  buildLlmResumeUserPrompt,
  buildLlmResumeDocumentUserPrompt,
} from "./llm-parse-prompt";
import {
  parseLlmResumeResponse,
  GEMINI_RESUME_RESPONSE_SCHEMA,
  type LlmResumeResponse,
} from "./llm-parse-schema";
import { RESUME_UPLOAD_MAX_BYTES } from "@/lib/recruitment/resume-import/file-validation";
import type { ResumeImportAiInsights, ResumeImportExtractionMeta } from "@/lib/recruitment/resume-import/types";

const LLM_RESUME_PARSER_VERSION = "llm-v3-single-pass";

const EMPTY_AI_INSIGHTS: ResumeImportAiInsights = {
  executiveSummary: null,
  strengths: [],
  gaps: [],
  matchScore: { value: null, rationale: null },
  clarificationFlags: [],
};

const EMPTY_EXTRACTION_META = (
  documentQuality: ResumeImportExtractionMeta["documentQuality"] = "image_only"
): ResumeImportExtractionMeta => ({
  documentQuality,
  fieldsRequiringReview: [],
  languageDetected: null,
});

/**
 * Maximum characters of extracted resume text to send to the LLM in fallback/text mode.
 */
const MAX_RESUME_TEXT_CHARS = 200_000;

/** Timeout for the Gemini request (ms). */
const LLM_REQUEST_TIMEOUT_MS = 60_000;

const PDF_MIMES = new Set(["application/pdf", "application/x-pdf"]);
const DOCX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/docx",
]);

/**
 * Normalize and validate file MIME type for Gemini document input.
 */
export function normalizeDocumentMimeType(fileName: string, mimeType: string): string | null {
  const parts = fileName.toLowerCase().split(".");
  const ext = parts.length > 1 ? (parts.at(-1) ?? "") : "";
  const mime = (mimeType || "").toLowerCase().trim();

  if (ext === "pdf" || PDF_MIMES.has(mime)) {
    return "application/pdf";
  }
  if (ext === "docx" || DOCX_MIMES.has(mime)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Gemini REST call — sends inlineData for PDF/DOCX base64 content
// ---------------------------------------------------------------------------

function looksLikeOpenAiApiKey(apiKey: string): boolean {
  return apiKey.startsWith("sk-") || apiKey.startsWith("sk-proj-");
}

async function readGeminiErrorDetail(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; status?: string };
    };
    return body.error?.message?.trim() || null;
  } catch {
    return null;
  }
}

export type GeminiPostResult =
  | { ok: true; text: string }
  | { ok: false; error: string; retryable: boolean };

export type GeminiResumePostInput = {
  apiKey: string;
  model: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 string
  };
  userPromptText: string;
};

async function postGeminiResumeExtraction(input: GeminiResumePostInput): Promise<GeminiPostResult> {
  if (looksLikeOpenAiApiKey(input.apiKey)) {
    return {
      ok: false,
      error:
        "GEMINI_API_KEY looks like an OpenAI key (sk-…). Use a Google AI Studio Gemini key (AIza… or AQ.…).",
      retryable: false,
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    input.model
  )}:generateContent`;

  const parts: Array<Record<string, unknown>> = [];
  if (input.inlineData) {
    parts.push({
      inlineData: {
        mimeType: input.inlineData.mimeType,
        data: input.inlineData.data,
      },
    });
  }
  parts.push({ text: input.userPromptText });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: RESUME_INTELLIGENCE_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.1,
          // Raised from 8192: single-pass responses now also carry aiInsights + extractionMeta.
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESUME_RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini request failed.";
    const timedOut = /timeout|aborted|AbortError/i.test(message);
    return {
      ok: false,
      error: timedOut ? "Gemini request timed out." : message,
      retryable: true,
    };
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    const detail = await readGeminiErrorDetail(response);
    return {
      ok: false,
      error: detail
        ? `Gemini HTTP ${response.status}: ${detail}`
        : `Gemini HTTP ${response.status}`,
      retryable,
    };
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    return { ok: false, error: "Gemini returned empty content.", retryable: true };
  }
  return { ok: true, text };
}

// ---------------------------------------------------------------------------
// Map validated LLM response → ResumeImportMappedDraft
// ---------------------------------------------------------------------------

function mapLlmResponseToDraft(
  data: LlmResumeResponse,
): ResumeImportDraftContent["mapped"] {
  return {
    personal: {
      fullName: data.fullName ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      location: data.location ?? null,
    },
    professional: {
      headline: data.headline ?? null,
      professionalSummary: data.professionalSummary ?? null,
      currentCompany: data.currentCompany ?? null,
      currentTitle: data.currentTitle ?? null,
      githubUrl: data.githubUrl ?? null,
      linkedinUrl: data.linkedinUrl ?? null,
      portfolioUrl: data.portfolioUrl ?? null,
      totalExperienceYears: data.totalExperienceYears ?? null,
      preferredWorkMode: null,
      willingToRelocate: null,
    },
    experiences: (data.experiences ?? []).map((e, i) => ({
      company: e.company,
      title: e.title,
      location: e.location ?? null,
      startDate: e.startDate ?? null,
      endDate: e.endDate ?? null,
      isCurrent: e.isCurrent ?? false,
      description: e.description ?? null,
      sortOrder: i,
    })),
    educations: (data.educations ?? []).map((e, i) => ({
      institution: e.institution,
      degree: e.degree ?? null,
      field: e.field ?? null,
      startYear: e.startYear ?? null,
      endYear: e.endYear ?? null,
      grade: e.grade ?? null,
      sortOrder: i,
    })),
    skills: (data.skills ?? []).map((s) => ({
      name: s.name,
      proficiency: s.proficiency ?? null,
      yearsOfExperience: s.yearsOfExperience ?? null,
    })),
    projects: (data.projects ?? []).map((p, i) => ({
      title: p.title,
      summary: p.summary ?? null,
      techStack: p.techStack ?? null,
      url: p.url ?? null,
      role: p.role ?? null,
      duration: p.duration ?? null,
      sortOrder: i,
    })),
    certifications: (data.certifications ?? []).map((c) => ({
      name: c.name,
      issuer: c.issuer ?? null,
      issuedAt: c.issuedAt ?? null,
      expiresAt: c.expiresAt ?? null,
      credentialId: c.credentialId ?? null,
      credentialUrl: c.credentialUrl ?? null,
    })),
  };
}

function mapLlmResponseToAiInsights(data: LlmResumeResponse): ResumeImportAiInsights {
  return {
    executiveSummary: data.aiInsights?.executiveSummary ?? null,
    strengths: data.aiInsights?.strengths ?? [],
    gaps: data.aiInsights?.gaps ?? [],
    matchScore: {
      value: data.aiInsights?.matchScore?.value ?? null,
      rationale: data.aiInsights?.matchScore?.rationale ?? null,
    },
    clarificationFlags: data.aiInsights?.clarificationFlags ?? [],
  };
}

function mapLlmResponseToExtractionMeta(data: LlmResumeResponse): ResumeImportExtractionMeta {
  return {
    documentQuality: data.extractionMeta?.documentQuality ?? "clean",
    fieldsRequiringReview: data.extractionMeta?.fieldsRequiringReview ?? [],
    languageDetected: data.extractionMeta?.languageDetected ?? null,
  };
}

function buildFieldConfidence(
  mapped: ResumeImportDraftContent["mapped"],
): Record<string, number> {
  const fc: Record<string, number> = {};
  const bump = (key: string, value: unknown, base = 0.85) => {
    if (value !== null && value !== undefined && value !== "") {
      fc[key] = base;
    }
  };

  bump("personal.fullName", mapped.personal.fullName, 0.85);
  bump("personal.email", mapped.personal.email, 0.95);
  bump("personal.phone", mapped.personal.phone, 0.9);
  bump("personal.location", mapped.personal.location, 0.8);
  bump("professional.linkedinUrl", mapped.professional.linkedinUrl, 0.95);
  bump("professional.githubUrl", mapped.professional.githubUrl, 0.95);
  bump("professional.portfolioUrl", mapped.professional.portfolioUrl, 0.85);
  bump("professional.professionalSummary", mapped.professional.professionalSummary, 0.75);
  bump("professional.headline", mapped.professional.headline, 0.85);
  bump("professional.currentCompany", mapped.professional.currentCompany, 0.8);
  bump("professional.currentTitle", mapped.professional.currentTitle, 0.8);
  bump("professional.totalExperienceYears", mapped.professional.totalExperienceYears, 0.7);

  if (mapped.experiences.length) fc["section.experiences"] = 0.8;
  if (mapped.educations.length) fc["section.educations"] = 0.8;
  if (mapped.skills.length) fc["section.skills"] = 0.85;
  if (mapped.projects.length) fc["section.projects"] = 0.75;
  if (mapped.certifications.length) fc["section.certifications"] = 0.75;

  return fc;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type LlmResumeGeneratorInput = {
  inlineData?: {
    mimeType: string;
    data: string;
  };
  resumeText?: string;
  userPromptText: string;
};

/** Test seam: injectable Gemini call. */
export type LlmResumeGenerator = (
  input: LlmResumeGeneratorInput | string,
) => Promise<GeminiPostResult>;

export type ParseResumeDocumentInput = {
  content: Buffer | Uint8Array;
  fileName: string;
  mimeType: string;
  documentId?: string | null;
  /** Optional JD text — enables aiInsights.matchScore. Omit/null leaves matchScore null. */
  jobDescription?: string | null;
};

/**
 * Parse a resume by sending the original document (or plain text) directly to Gemini.
 *
 * Returns the same `{ result, draftContent }` shape as the deterministic
 * `parseResumeDocument`, so the downstream merge/review flow is unchanged.
 *
 * Does NOT write to the database.
 */
export async function parseResumeWithLlm(
  inputOrText: ParseResumeDocumentInput | string,
  documentIdOrOptions?: string | null | { generate?: LlmResumeGenerator },
  optionsParam?: { generate?: LlmResumeGenerator }
): Promise<{
  result: ResumeParseResult;
  draftContent: ResumeImportDraftContent;
}> {
  const startMs = Date.now();

  const isDocInput = typeof inputOrText === "object" && inputOrText !== null;
  const documentId = isDocInput
    ? (inputOrText.documentId ?? null)
    : typeof documentIdOrOptions === "string"
      ? documentIdOrOptions
      : null;

  const options = isDocInput
    ? (typeof documentIdOrOptions === "object" && documentIdOrOptions ? documentIdOrOptions : optionsParam)
    : optionsParam;

  let resolvedMimeType: string | null = null;
  let fileSizeBytes = 0;
  let base64Data: string | null = null;
  let resumeText: string | null = null;
  let userPromptText: string;

  if (isDocInput) {
    const bytes = Buffer.isBuffer(inputOrText.content)
      ? inputOrText.content
      : Buffer.from(inputOrText.content);

    fileSizeBytes = bytes.byteLength;

    if (fileSizeBytes === 0) {
      const empty = EMPTY_PARSED_RESUME_DRAFT();
      const result: ResumeParseResult = {
        ok: false,
        error: {
          code: "EMPTY_DOCUMENT",
          message: "The uploaded resume file is empty.",
        },
        draft: empty,
        warnings: ["Empty file buffer."],
      };
      return {
        result,
        draftContent: {
          version: 1,
          source: "ai",
          documentId,
          raw: { fileSizeBytes: 0 },
          mapped: mapLlmResponseToDraft({} as LlmResumeResponse),
          fieldConfidence: {},
          aiInsights: EMPTY_AI_INSIGHTS,
          extractionMeta: EMPTY_EXTRACTION_META(),
          metadata: {
            parserVersion: LLM_RESUME_PARSER_VERSION,
            note: "Empty file buffer.",
          },
        },
      };
    }

    if (fileSizeBytes > RESUME_UPLOAD_MAX_BYTES) {
      const empty = EMPTY_PARSED_RESUME_DRAFT();
      const result: ResumeParseResult = {
        ok: false,
        error: {
          code: "PARSE_FAILED",
          message: `Resume file is too large for Gemini parsing (${fileSizeBytes} bytes, max ${RESUME_UPLOAD_MAX_BYTES} bytes).`,
        },
        draft: empty,
        warnings: ["Resume file size exceeds maximum supported limit."],
      };
      return {
        result,
        draftContent: {
          version: 1,
          source: "ai",
          documentId,
          raw: { fileSizeBytes },
          mapped: mapLlmResponseToDraft({} as LlmResumeResponse),
          fieldConfidence: {},
          aiInsights: EMPTY_AI_INSIGHTS,
          extractionMeta: EMPTY_EXTRACTION_META(),
          metadata: {
            parserVersion: LLM_RESUME_PARSER_VERSION,
            note: "Resume file too large for Gemini parsing.",
          },
        },
      };
    }

    resolvedMimeType = normalizeDocumentMimeType(inputOrText.fileName, inputOrText.mimeType);
    if (!resolvedMimeType) {
      const empty = EMPTY_PARSED_RESUME_DRAFT();
      const result: ResumeParseResult = {
        ok: false,
        error: {
          code: "UNSUPPORTED_TYPE",
          message: `Only PDF and DOCX resumes are supported for LLM parsing. (${inputOrText.fileName})`,
        },
        draft: empty,
        warnings: ["Unsupported document type for LLM parsing."],
      };
      return {
        result,
        draftContent: {
          version: 1,
          source: "ai",
          documentId,
          raw: { fileName: inputOrText.fileName, mimeType: inputOrText.mimeType },
          mapped: mapLlmResponseToDraft({} as LlmResumeResponse),
          fieldConfidence: {},
          aiInsights: EMPTY_AI_INSIGHTS,
          extractionMeta: EMPTY_EXTRACTION_META(),
          metadata: {
            parserVersion: LLM_RESUME_PARSER_VERSION,
            note: "Unsupported document type.",
          },
        },
      };
    }

    base64Data = bytes.toString("base64");
    userPromptText = buildLlmResumeDocumentUserPrompt(inputOrText.jobDescription);

    logger.info("recruitment.resume.llm_parse_started", {
      entityType: "resume",
      parseMode: "llm",
      mimeType: resolvedMimeType,
      fileSizeBytes: String(fileSizeBytes),
    });
  } else {
    // String (text mode fallback)
    resumeText = inputOrText;
    if (!resumeText || !resumeText.trim()) {
      const empty = EMPTY_PARSED_RESUME_DRAFT();
      const result: ResumeParseResult = {
        ok: false,
        error: {
          code: "EMPTY_DOCUMENT",
          message: "No text could be extracted from the resume.",
        },
        draft: empty,
        warnings: ["Empty extractable text."],
      };
      return {
        result,
        draftContent: {
          version: 1,
          source: "ai",
          documentId,
          raw: { textLength: 0 },
          mapped: mapLlmResponseToDraft({} as LlmResumeResponse),
          fieldConfidence: {},
          aiInsights: EMPTY_AI_INSIGHTS,
          extractionMeta: EMPTY_EXTRACTION_META(),
          metadata: {
            parserVersion: LLM_RESUME_PARSER_VERSION,
            note: "Empty resume text.",
          },
        },
      };
    }

    if (resumeText.length > MAX_RESUME_TEXT_CHARS) {
      const empty = EMPTY_PARSED_RESUME_DRAFT();
      const result: ResumeParseResult = {
        ok: false,
        error: {
          code: "PARSE_FAILED",
          message: `Resume text is too large for LLM parsing (${resumeText.length} chars, max ${MAX_RESUME_TEXT_CHARS}).`,
        },
        draft: empty,
        warnings: ["Resume text exceeds maximum length for LLM parsing."],
      };
      return {
        result,
        draftContent: {
          version: 1,
          source: "ai",
          documentId,
          raw: { textLength: resumeText.length },
          mapped: mapLlmResponseToDraft({} as LlmResumeResponse),
          fieldConfidence: {},
          aiInsights: EMPTY_AI_INSIGHTS,
          extractionMeta: EMPTY_EXTRACTION_META(),
          metadata: {
            parserVersion: LLM_RESUME_PARSER_VERSION,
            note: "Resume text too large for LLM parsing.",
          },
        },
      };
    }

    userPromptText = buildLlmResumeUserPrompt(resumeText);
    logger.info("recruitment.resume.llm_parse_started", {
      entityType: "resume",
      parseMode: "llm",
      textLength: String(resumeText.length),
    });
  }

  // --- Call Gemini ---
  let posted: GeminiPostResult;

  if (options?.generate) {
    if (isDocInput && base64Data && resolvedMimeType) {
      posted = await options.generate({
        inlineData: { mimeType: resolvedMimeType, data: base64Data },
        userPromptText,
      });
    } else {
      posted = await options.generate(
        typeof inputOrText === "string" ? inputOrText : { userPromptText }
      );
    }
  } else {
    const apiKey = getGeminiApiKey();
    const model = getGeminiModel();

    if (!apiKey) {
      logger.error("recruitment.resume.llm_parse_failed", {
        entityType: "resume",
        parseMode: "llm",
        errorCode: "missing_api_key",
      });
      const empty = EMPTY_PARSED_RESUME_DRAFT();
      const result: ResumeParseResult = {
        ok: false,
        error: {
          code: "PARSE_FAILED",
          message: "GEMINI_API_KEY is not configured. Cannot use LLM resume parsing.",
        },
        draft: empty,
        warnings: ["GEMINI_API_KEY is not configured."],
      };
      return {
        result,
        draftContent: {
          version: 1,
          source: "ai",
          documentId,
          raw: isDocInput ? { fileSizeBytes } : { textLength: (resumeText ?? "").length },
          mapped: mapLlmResponseToDraft({} as LlmResumeResponse),
          fieldConfidence: {},
          aiInsights: EMPTY_AI_INSIGHTS,
          extractionMeta: EMPTY_EXTRACTION_META(),
          metadata: {
            parserVersion: LLM_RESUME_PARSER_VERSION,
            note: "GEMINI_API_KEY not configured.",
          },
        },
      };
    }

    const postInput: GeminiResumePostInput = {
      apiKey,
      model,
      inlineData: base64Data && resolvedMimeType ? { mimeType: resolvedMimeType, data: base64Data } : undefined,
      userPromptText,
    };

    // First attempt
    posted = await postGeminiResumeExtraction(postInput);

    // Retry once on transient failure
    if (!posted.ok && posted.retryable) {
      posted = await postGeminiResumeExtraction(postInput);
    }
  }

  const durationMs = Date.now() - startMs;

  if (!posted.ok) {
    logger.error("recruitment.resume.llm_request_failed", {
      entityType: "resume",
      parseMode: "llm",
      errorCode: "llm_api_error",
      durationMs: String(durationMs),
    });
    const empty = EMPTY_PARSED_RESUME_DRAFT();
    const result: ResumeParseResult = {
      ok: false,
      error: {
        code: "PARSE_FAILED",
        message: `LLM resume parsing failed: ${posted.error}`,
      },
      draft: empty,
      warnings: [`LLM API error: ${posted.error}`],
    };
    return {
      result,
      draftContent: {
        version: 1,
        source: "ai",
        documentId,
        raw: isDocInput ? { fileSizeBytes } : { textLength: (resumeText ?? "").length },
        mapped: mapLlmResponseToDraft({} as LlmResumeResponse),
        fieldConfidence: {},
        aiInsights: EMPTY_AI_INSIGHTS,
        extractionMeta: EMPTY_EXTRACTION_META(),
        metadata: {
          parserVersion: LLM_RESUME_PARSER_VERSION,
          note: `LLM request failed: ${posted.error}`,
        },
      },
    };
  }

  // --- Parse JSON response ---
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(posted.text);
  } catch {
    logger.error("recruitment.resume.llm_parse_failed", {
      entityType: "resume",
      parseMode: "llm",
      errorCode: "json_parse_error",
      durationMs: String(durationMs),
    });
    const empty = EMPTY_PARSED_RESUME_DRAFT();
    const result: ResumeParseResult = {
      ok: false,
      error: {
        code: "PARSE_FAILED",
        message: "LLM returned malformed JSON.",
      },
      draft: empty,
      warnings: ["LLM response was not valid JSON."],
    };
    return {
      result,
      draftContent: {
        version: 1,
        source: "ai",
        documentId,
        raw: isDocInput ? { fileSizeBytes } : { textLength: (resumeText ?? "").length },
        mapped: mapLlmResponseToDraft({} as LlmResumeResponse),
        fieldConfidence: {},
        aiInsights: EMPTY_AI_INSIGHTS,
        extractionMeta: EMPTY_EXTRACTION_META(),
        metadata: {
          parserVersion: LLM_RESUME_PARSER_VERSION,
          note: "LLM returned malformed JSON.",
        },
      },
    };
  }

  // --- Zod validation ---
  const validated = parseLlmResumeResponse(parsedJson);
  if (!validated.ok) {
    logger.warn("recruitment.resume.llm_validation_failed", {
      entityType: "resume",
      parseMode: "llm",
      errorCode: "zod_validation_error",
      durationMs: String(durationMs),
    });
    const empty = EMPTY_PARSED_RESUME_DRAFT();
    const result: ResumeParseResult = {
      ok: false,
      error: {
        code: "PARSE_FAILED",
        message: validated.error,
      },
      draft: empty,
      warnings: [validated.error],
    };
    return {
      result,
      draftContent: {
        version: 1,
        source: "ai",
        documentId,
        raw: isDocInput ? { fileSizeBytes } : { textLength: (resumeText ?? "").length },
        mapped: mapLlmResponseToDraft({} as LlmResumeResponse),
        fieldConfidence: {},
        aiInsights: EMPTY_AI_INSIGHTS,
        extractionMeta: EMPTY_EXTRACTION_META(),
        metadata: {
          parserVersion: LLM_RESUME_PARSER_VERSION,
          note: validated.error,
        },
      },
    };
  }

  // --- Map to draft ---
  const mapped = mapLlmResponseToDraft(validated.data);
  const fieldConfidence = buildFieldConfidence(mapped);
  const aiInsights = mapLlmResponseToAiInsights(validated.data);
  const extractionMeta = mapLlmResponseToExtractionMeta(validated.data);

  logger.info("recruitment.resume.llm_parse_succeeded", {
    entityType: "resume",
    parseMode: "llm",
    durationMs: String(durationMs),
    status: "success",
    documentQuality: extractionMeta.documentQuality,
    fieldsRequiringReview: String(extractionMeta.fieldsRequiringReview.length),
    hasMatchScore: String(aiInsights.matchScore.value !== null),
  });

  const draftContent: ResumeImportDraftContent = {
    version: 1,
    source: "ai",
    documentId,
    raw: isDocInput
      ? { fileSizeBytes, mimeType: resolvedMimeType }
      : { textLength: (resumeText ?? "").length },
    mapped,
    fieldConfidence,
    aiInsights,
    extractionMeta,
    metadata: {
      parserVersion: LLM_RESUME_PARSER_VERSION,
    },
  };

  const draft = EMPTY_PARSED_RESUME_DRAFT();
  draft.personal = {
    fullName: mapped.personal.fullName ?? null,
    email: mapped.personal.email ?? null,
    phone: mapped.personal.phone ?? null,
    location: mapped.personal.location ?? null,
    linkedinUrl: mapped.professional.linkedinUrl ?? null,
    githubUrl: mapped.professional.githubUrl ?? null,
    portfolioUrl: mapped.professional.portfolioUrl ?? null,
  };
  draft.professional = {
    headline: mapped.professional.headline ?? null,
    currentCompany: mapped.professional.currentCompany ?? null,
    currentTitle: mapped.professional.currentTitle ?? null,
    totalExperienceYears: mapped.professional.totalExperienceYears ?? null,
    summary: mapped.professional.professionalSummary ?? null,
  };
  draft.experiences = mapped.experiences.map((e) => ({
    company: e.company,
    title: e.title,
    location: e.location ?? null,
    startDate: e.startDate ?? null,
    endDate: e.endDate ?? null,
    isCurrent: e.isCurrent ?? false,
    description: e.description ?? null,
  }));
  draft.educations = mapped.educations.map((e) => ({
    institution: e.institution,
    degree: e.degree ?? null,
    field: e.field ?? null,
    graduationYear: e.endYear ?? null,
  }));
  draft.skills = mapped.skills.map((s) => s.name);
  draft.projects = mapped.projects.map((p) => ({
    title: p.title,
    summary: p.summary ?? null,
    techStack: p.techStack ?? null,
    url: p.url ?? null,
    duration: p.duration ?? null,
  }));
  draft.certifications = mapped.certifications.map((c) => ({
    name: c.name,
    issuer: c.issuer ?? null,
    issuedAt: c.issuedAt ?? null,
    credentialUrl: c.credentialUrl ?? null,
    credentialId: c.credentialId ?? null,
  }));

  const result: ResumeParseResult = {
    ok: true,
    draft,
    warnings: [],
    rawTextLength: isDocInput ? fileSizeBytes : (resumeText ?? "").length,
  };

  return { result, draftContent };
}
