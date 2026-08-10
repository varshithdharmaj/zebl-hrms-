import "server-only";

import {
  enrichmentContainsSensitiveInventions,
  parseEnrichmentOutput,
} from "./enrichment-schema";
import { parseRecoveryModelOutput } from "./recovery-schema";
import { getGeminiApiKey, getGeminiModel } from "./config";
import {
  buildCandidateEnrichmentUserPrompt,
  CANDIDATE_ENRICHMENT_SYSTEM_PROMPT,
} from "./prompt";
import {
  buildResumeFieldRecoveryUserPrompt,
  RESUME_FIELD_RECOVERY_SYSTEM_PROMPT,
} from "./recovery-prompt";
import type {
  AiGenerateResult,
  AiProvider,
  AiRecoveryGenerateResult,
} from "./provider";
import type { CandidateEnrichmentContext } from "./types";
import type { ResumeFieldRecoveryContext } from "./recovery-types";

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain a JSON object.");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function looksLikeOpenAiApiKey(apiKey: string): boolean {
  return apiKey.startsWith("sk-") || apiKey.startsWith("sk-proj-");
}

async function readGeminiErrorDetail(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; status?: string };
    };
    const message = body.error?.message?.trim();
    return message || null;
  } catch {
    return null;
  }
}

async function postGeminiJson(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
}): Promise<
  | { ok: true; text: string }
  | { ok: false; error: string; retryable?: boolean }
> {
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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: input.systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input.userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: input.maxOutputTokens,
        responseMimeType: "application/json",
      },
    }),
  });

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

async function callGeminiEnrichmentOnce(
  context: CandidateEnrichmentContext,
  apiKey: string,
  model: string
): Promise<AiGenerateResult> {
  const posted = await postGeminiJson({
    apiKey,
    model,
    systemPrompt: CANDIDATE_ENRICHMENT_SYSTEM_PROMPT,
    userPrompt: buildCandidateEnrichmentUserPrompt(context),
    maxOutputTokens: 2048,
  });
  if (!posted.ok) return posted;

  let parsedUnknown: unknown;
  try {
    parsedUnknown = extractJsonObject(posted.text);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse Gemini JSON.",
      retryable: true,
    };
  }

  const validated = parseEnrichmentOutput(parsedUnknown);
  if (!validated.ok) {
    return { ok: false, error: validated.error, retryable: true };
  }

  if (enrichmentContainsSensitiveInventions(validated.data)) {
    return {
      ok: false,
      error: "Enrichment output contained invented sensitive employment details.",
      retryable: true,
    };
  }

  return { ok: true, data: validated.data, modelId: model, rawText: posted.text };
}

async function callGeminiRecoveryOnce(
  context: ResumeFieldRecoveryContext,
  apiKey: string,
  model: string
): Promise<AiRecoveryGenerateResult> {
  if (context.eligibleFields.length === 0) {
    return { ok: true, data: [], modelId: model };
  }

  const posted = await postGeminiJson({
    apiKey,
    model,
    systemPrompt: RESUME_FIELD_RECOVERY_SYSTEM_PROMPT,
    userPrompt: buildResumeFieldRecoveryUserPrompt(context),
    maxOutputTokens: 3072,
  });
  if (!posted.ok) return posted;

  let parsedUnknown: unknown;
  try {
    parsedUnknown = extractJsonObject(posted.text);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse Gemini JSON.",
      retryable: true,
    };
  }

  const validated = parseRecoveryModelOutput(parsedUnknown);
  if (!validated.ok) {
    return { ok: false, error: validated.error, retryable: true };
  }

  const eligible = new Set(context.eligibleFields);
  const filtered = validated.data.filter((row) => eligible.has(row.field));
  return { ok: true, data: filtered, modelId: model, rawText: posted.text };
}

export function createGeminiProvider(options?: {
  apiKey?: string | null;
  model?: string;
}): AiProvider {
  return {
    id: "gemini",
    async generateCandidateEnrichment(context) {
      const apiKey = options?.apiKey ?? getGeminiApiKey();
      const model = options?.model ?? getGeminiModel();
      if (!apiKey) {
        return { ok: false, error: "GEMINI_API_KEY is not configured.", retryable: false };
      }

      const first = await callGeminiEnrichmentOnce(context, apiKey, model);
      if (first.ok || !first.retryable) return first;
      return callGeminiEnrichmentOnce(context, apiKey, model);
    },
    async generateResumeFieldRecovery(context) {
      const apiKey = options?.apiKey ?? getGeminiApiKey();
      const model = options?.model ?? getGeminiModel();
      if (!apiKey) {
        return { ok: false, error: "GEMINI_API_KEY is not configured.", retryable: false };
      }

      const first = await callGeminiRecoveryOnce(context, apiKey, model);
      if (first.ok || !first.retryable) return first;
      return callGeminiRecoveryOnce(context, apiKey, model);
    },
  };
}
