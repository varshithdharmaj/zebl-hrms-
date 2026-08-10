import "server-only";

import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "default";

export type AiRuntimeConfig = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  reasonDisabled: string | null;
};

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

/**
 * aiEnabled from RecruitmentSettings (default true if row missing) + API key gate.
 */
export async function getAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  const apiKey = getGeminiApiKey();
  const model = getGeminiModel();

  let aiEnabled = true;
  try {
    const row = await prisma.recruitmentSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: { aiEnabled: true },
    });
    if (row) aiEnabled = row.aiEnabled;
  } catch {
    // Settings table unavailable — treat as enabled if key present.
    aiEnabled = true;
  }

  if (!aiEnabled) {
    return {
      enabled: false,
      apiKey,
      model,
      reasonDisabled: "AI enrichment is disabled in recruitment settings.",
    };
  }
  if (!apiKey) {
    return {
      enabled: false,
      apiKey: null,
      model,
      reasonDisabled: "GEMINI_API_KEY is not configured.",
    };
  }
  return { enabled: true, apiKey, model, reasonDisabled: null };
}
