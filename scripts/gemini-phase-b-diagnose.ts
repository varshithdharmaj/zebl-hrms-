/**
 * Isolated Phase B Gemini diagnostics.
 * Does NOT touch parser, Prisma, Candidate, or the resume corpus.
 *
 * Usage (from ZEBL_AMS):
 *   npx tsx scripts/gemini-phase-b-diagnose.ts
 *
 * Never prints API keys or authorization headers.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

function loadEnvFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const smokeSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

function classifyKeyShape(apiKey: string): "openai_sk_pattern" | "google_ai_studio_pattern" | "other" {
  if (apiKey.startsWith("sk-") || apiKey.startsWith("sk-proj-")) {
    return "openai_sk_pattern";
  }
  if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) {
    return "google_ai_studio_pattern";
  }
  return "other";
}

function redactLongSecrets(text: string): string {
  return text.replace(/[A-Za-z0-9_\-]{24,}/g, "[redacted]");
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const host = "generativelanguage.googleapis.com";
  const apiVersion = "v1beta";
  const generatePath = `/v1beta/models/${model}:generateContent`;
  const listPath = `/v1beta/models`;

  console.log("=== Configuration (sanitized) ===");
  console.log(
    JSON.stringify(
      {
        GEMINI_API_KEY_present: Boolean(apiKey),
        GEMINI_API_KEY_length: apiKey.length,
        GEMINI_MODEL: model,
        keyShapeClass: apiKey ? classifyKeyShape(apiKey) : "missing",
        endpointHost: host,
        apiVersion,
        generatePath,
        authMechanism: "header x-goog-api-key (value not logged)",
        requestPayloadStructure: {
          systemInstruction: { parts: [{ text: "string" }] },
          contents: [{ role: "user", parts: [{ text: "string" }] }],
          generationConfig: {
            temperature: "number",
            maxOutputTokens: "number",
            responseMimeType: "application/json",
          },
        },
        envLoadOrder: [".env", ".env.local (overrides only if key already unset — first wins)"],
      },
      null,
      2
    )
  );

  if (!apiKey) {
    console.log(
      JSON.stringify({
        smoke: "aborted",
        reason: "GEMINI_API_KEY missing after .env load",
      })
    );
    process.exitCode = 1;
    return;
  }

  // --- List models (validates key + model availability) ---
  console.log("\n=== Model list probe ===");
  try {
    const listUrl = `https://${host}${listPath}?pageSize=50`;
    const listRes = await fetch(listUrl, {
      method: "GET",
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(25_000),
    });
    const listText = await listRes.text();
    let listJson: {
      error?: { code?: number; message?: string; status?: string };
      models?: Array<{ name?: string }>;
    } | null = null;
    try {
      listJson = JSON.parse(listText) as typeof listJson;
    } catch {
      listJson = null;
    }

    const modelNames =
      listJson?.models
        ?.map((m) => m.name?.replace(/^models\//, "") ?? "")
        .filter(Boolean)
        .slice(0, 40) ?? [];

    console.log(
      JSON.stringify(
        {
          httpStatus: listRes.status,
          googleErrorCode: listJson?.error?.code ?? null,
          googleErrorStatus: listJson?.error?.status ?? null,
          googleErrorMessage: listJson?.error?.message
            ? redactLongSecrets(listJson.error.message)
            : null,
          configuredModel: model,
          configuredModelListed: modelNames.includes(model),
          sampleModelNames: modelNames.slice(0, 15),
        },
        null,
        2
      )
    );
  } catch (err) {
    console.log(
      JSON.stringify({
        listProbeError:
          err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160),
      })
    );
  }

  // --- Minimal generateContent smoke (same shape as llm-verify) ---
  console.log("\n=== Minimal generateContent smoke ===");
  const url = `https://${host}${generatePath}`;
  const userText = [
    "Extract the candidate's name from:",
    "",
    "Jane Doe",
    "Software Engineer",
    "Bengaluru",
    "",
    'Return JSON only: {"name":"..."}',
  ].join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: "Return JSON only. Do not invent fields." }],
      },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 128,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });

  const rawBody = await response.text();
  let parsedBody: {
    error?: { code?: number; message?: string; status?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } | null = null;
  try {
    parsedBody = JSON.parse(rawBody) as typeof parsedBody;
  } catch {
    parsedBody = null;
  }

  const modelText = parsedBody?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  let zodOk: boolean | null = null;
  let zodName: string | null = null;
  if (modelText) {
    try {
      const start = modelText.indexOf("{");
      const end = modelText.lastIndexOf("}");
      const jsonSlice =
        start >= 0 && end > start ? modelText.slice(start, end + 1) : modelText;
      const validated = smokeSchema.safeParse(JSON.parse(jsonSlice));
      zodOk = validated.success;
      zodName = validated.success ? validated.data.name : null;
    } catch {
      zodOk = false;
    }
  }

  console.log(
    JSON.stringify(
      {
        httpStatus: response.status,
        endpoint: `${host}${generatePath}`,
        method: "POST",
        apiVersion,
        model,
        googleErrorCode: parsedBody?.error?.code ?? null,
        googleErrorStatus: parsedBody?.error?.status ?? null,
        googleErrorMessage: parsedBody?.error?.message
          ? redactLongSecrets(parsedBody.error.message)
          : null,
        geminiResponsePreview: modelText
          ? redactLongSecrets(modelText).slice(0, 200)
          : null,
        zodValidation: zodOk,
        zodName,
      },
      null,
      2
    )
  );

  if (response.status !== 200 || zodOk !== true) {
    process.exitCode = 1;
    console.log(
      "\nNext step: Fix Gemini configuration/API integration first. Do not run the full Phase B benchmark yet."
    );
  } else {
    console.log("\nNext step: Run the full Phase B benchmark.");
  }
}

await main();
