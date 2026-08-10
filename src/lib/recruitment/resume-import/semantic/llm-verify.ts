import "server-only";

import { getGeminiApiKey, getGeminiModel } from "@/lib/recruitment/ai/config";
import type { ParsedResumeDraft } from "../parser/types";
import type { ResumeAmbiguity } from "./ambiguity";
import {
  buildSemanticVerifyUserPrompt,
  RESUME_SEMANTIC_VERIFY_SYSTEM_PROMPT,
} from "./llm-verify-prompt";
import {
  parseSemanticVerificationOutput,
  type SemanticVerificationResult,
} from "./llm-verify-schema";

export type GeminiUsageTokens = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type SemanticVerifyGenerateResult =
  | {
      ok: true;
      data: SemanticVerificationResult;
      modelId: string;
      latencyMs: number;
      retries: number;
      timedOut: boolean;
      usage: GeminiUsageTokens | null;
    }
  | {
      ok: false;
      error: string;
      retryable?: boolean;
      latencyMs?: number;
      retries?: number;
      timedOut?: boolean;
      usage?: GeminiUsageTokens | null;
    };

export type SemanticVerifyGenerator = (input: {
  draft: ParsedResumeDraft;
  ambiguity: ResumeAmbiguity;
}) => Promise<SemanticVerifyGenerateResult>;

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

function parseUsage(json: {
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}): GeminiUsageTokens | null {
  const u = json.usageMetadata;
  if (!u) return null;
  return {
    inputTokens:
      typeof u.promptTokenCount === "number" ? u.promptTokenCount : null,
    outputTokens:
      typeof u.candidatesTokenCount === "number" ? u.candidatesTokenCount : null,
    totalTokens:
      typeof u.totalTokenCount === "number" ? u.totalTokenCount : null,
  };
}

/** Same shape check as recruitment gemini-provider (no key material logged). */
function looksLikeOpenAiApiKey(apiKey: string): boolean {
  return apiKey.startsWith("sk-") || apiKey.startsWith("sk-proj-");
}

async function readGeminiErrorDetail(response: Response): Promise<{
  message: string | null;
  status: string | null;
  code: number | null;
}> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; status?: string; code?: number };
    };
    return {
      message: body.error?.message?.trim() || null,
      status: body.error?.status?.trim() || null,
      code: typeof body.error?.code === "number" ? body.error.code : null,
    };
  } catch {
    return { message: null, status: null, code: null };
  }
}

async function postGeminiJson(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
}): Promise<
  | { ok: true; text: string; usage: GeminiUsageTokens | null; timedOut: false }
  | { ok: false; error: string; retryable?: boolean; timedOut?: boolean }
> {
  // Align with gemini-provider: reject obvious OpenAI keys before calling Google.
  if (looksLikeOpenAiApiKey(input.apiKey)) {
    return {
      ok: false,
      error:
        "GEMINI_API_KEY looks like an OpenAI key (sk-…). Use a Google AI Studio Gemini key (AIza… or AQ.…).",
      retryable: false,
      timedOut: false,
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    input.model
  )}:generateContent`;

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
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini request failed.";
    const timedOut = /timeout|aborted|AbortError/i.test(message);
    return {
      ok: false,
      error: message,
      retryable: true,
      timedOut,
    };
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    const detail = await readGeminiErrorDetail(response);
    const parts = [
      `Gemini HTTP ${response.status}`,
      detail.status ? `status=${detail.status}` : null,
      detail.code != null ? `code=${detail.code}` : null,
      detail.message ? detail.message : null,
    ].filter(Boolean);
    return {
      ok: false,
      error: parts.join(": "),
      retryable,
      timedOut: false,
    };
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    return {
      ok: false,
      error: "Gemini returned empty content.",
      retryable: true,
      timedOut: false,
    };
  }
  return { ok: true, text, usage: parseUsage(json), timedOut: false };
}

async function callOnce(
  draft: ParsedResumeDraft,
  ambiguity: ResumeAmbiguity,
  apiKey: string,
  model: string
): Promise<SemanticVerifyGenerateResult> {
  const started = Date.now();
  const posted = await postGeminiJson({
    apiKey,
    model,
    systemPrompt: RESUME_SEMANTIC_VERIFY_SYSTEM_PROMPT,
    userPrompt: buildSemanticVerifyUserPrompt({ draft, ambiguity }),
    maxOutputTokens: 2048,
  });
  const latencyMs = Date.now() - started;
  if (!posted.ok) {
    return {
      ...posted,
      latencyMs,
      retries: 0,
      timedOut: Boolean(posted.timedOut),
      usage: null,
    };
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = extractJsonObject(posted.text);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse Gemini JSON.",
      retryable: true,
      latencyMs,
      retries: 0,
      timedOut: false,
      usage: posted.usage,
    };
  }

  const validated = parseSemanticVerificationOutput(parsedUnknown);
  if (!validated.ok) {
    return {
      ok: false,
      error: validated.error,
      retryable: true,
      latencyMs,
      retries: 0,
      timedOut: false,
      usage: posted.usage,
    };
  }
  return {
    ok: true,
    data: validated.data,
    modelId: model,
    latencyMs,
    retries: 0,
    timedOut: false,
    usage: posted.usage,
  };
}

/** Default Gemini-backed generator using existing GEMINI_* config. */
export function createGeminiSemanticVerifyGenerator(options?: {
  apiKey?: string | null;
  model?: string;
}): SemanticVerifyGenerator {
  return async ({ draft, ambiguity }) => {
    const apiKey = options?.apiKey ?? getGeminiApiKey();
    const model = options?.model ?? getGeminiModel();
    if (!apiKey) {
      return {
        ok: false,
        error: "GEMINI_API_KEY is not configured.",
        retryable: false,
        latencyMs: 0,
        retries: 0,
        timedOut: false,
        usage: null,
      };
    }
    const first = await callOnce(draft, ambiguity, apiKey, model);
    if (first.ok || !first.retryable) return first;
    const second = await callOnce(draft, ambiguity, apiKey, model);
    const retries = 1;
    if (second.ok) {
      return {
        ...second,
        retries,
        latencyMs: (first.latencyMs ?? 0) + second.latencyMs,
        timedOut: Boolean(first.timedOut) || second.timedOut,
      };
    }
    return {
      ...second,
      retries,
      latencyMs: (first.latencyMs ?? 0) + (second.latencyMs ?? 0),
      timedOut: Boolean(first.timedOut) || Boolean(second.timedOut),
    };
  };
}

export async function verifyResumeSemantics(input: {
  draft: ParsedResumeDraft;
  ambiguity: ResumeAmbiguity;
  generate?: SemanticVerifyGenerator;
}): Promise<SemanticVerifyGenerateResult> {
  const generate = input.generate ?? createGeminiSemanticVerifyGenerator();
  return generate({ draft: input.draft, ambiguity: input.ambiguity });
}
