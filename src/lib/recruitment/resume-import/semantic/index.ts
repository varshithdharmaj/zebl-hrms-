import "server-only";

import { getAiRuntimeConfig } from "@/lib/recruitment/ai/config";
import type { ParsedResumeDraft } from "../parser/types";
import { detectResumeAmbiguity, type ResumeAmbiguity } from "./ambiguity";
import {
  createGeminiSemanticVerifyGenerator,
  type GeminiUsageTokens,
  type SemanticVerifyGenerator,
  verifyResumeSemantics,
} from "./llm-verify";
import type { SemanticVerificationDecision } from "./llm-verify-schema";
import { reconcileSemanticVerification } from "./reconcile";

export type SemanticVerificationMeta = {
  attempted: boolean;
  skipped: boolean;
  skipReason: string | null;
  ambiguityReasons: string[];
  llmSuccess: boolean | null;
  llmError: string | null;
  decisionCount: number;
  accepted: number;
  rejected: number;
  unsupported: number;
  fallbackDeterministic: boolean;
  modelId: string | null;
  /** Observability (Phase B+ live bench). */
  latencyMs: number | null;
  retries: number;
  timedOut: boolean;
  usage: GeminiUsageTokens | null;
  decisions: SemanticVerificationDecision[];
  reconcileNotes: string[];
  leaveEmptyCount: number;
  reclassifyCount: number;
};

export type SemanticPipelineResult = {
  draft: ParsedResumeDraft;
  ambiguity: ResumeAmbiguity;
  meta: SemanticVerificationMeta;
};

function baseMeta(
  partial: Partial<SemanticVerificationMeta> &
    Pick<SemanticVerificationMeta, "attempted" | "skipped">
): SemanticVerificationMeta {
  return {
    skipReason: null,
    ambiguityReasons: [],
    llmSuccess: null,
    llmError: null,
    decisionCount: 0,
    accepted: 0,
    rejected: 0,
    unsupported: 0,
    fallbackDeterministic: false,
    modelId: null,
    latencyMs: null,
    retries: 0,
    timedOut: false,
    usage: null,
    decisions: [],
    reconcileNotes: [],
    leaveEmptyCount: 0,
    reclassifyCount: 0,
    ...partial,
  };
}

/**
 * Selective semantic verification pipeline.
 * Always safe to call — falls back to deterministic draft on any AI failure.
 */
export async function runSemanticVerificationPipeline(input: {
  draft: ParsedResumeDraft;
  cleanedText: string;
  warnings?: string[];
  /** Force skip LLM (tests / offline). Ambiguity is still computed. */
  skipLlm?: boolean;
  generate?: SemanticVerifyGenerator;
}): Promise<SemanticPipelineResult> {
  const ambiguity = detectResumeAmbiguity({
    draft: input.draft,
    cleanedText: input.cleanedText,
    warnings: input.warnings,
  });

  if (!ambiguity.needsVerification) {
    return {
      draft: input.draft,
      ambiguity,
      meta: baseMeta({
        attempted: false,
        skipped: true,
        skipReason: "no_ambiguity",
        ambiguityReasons: [],
      }),
    };
  }

  if (input.skipLlm) {
    return {
      draft: input.draft,
      ambiguity,
      meta: baseMeta({
        attempted: false,
        skipped: true,
        skipReason: "skipLlm_flag",
        ambiguityReasons: ambiguity.reasons,
        fallbackDeterministic: true,
      }),
    };
  }

  let generate = input.generate;
  let modelHint: string | null = null;

  if (!generate) {
    const runtime = await getAiRuntimeConfig();
    if (!runtime.enabled) {
      return {
        draft: input.draft,
        ambiguity,
        meta: baseMeta({
          attempted: false,
          skipped: true,
          skipReason: runtime.reasonDisabled ?? "ai_disabled",
          ambiguityReasons: ambiguity.reasons,
          fallbackDeterministic: true,
        }),
      };
    }
    modelHint = runtime.model;
    generate = createGeminiSemanticVerifyGenerator({
      apiKey: runtime.apiKey,
      model: runtime.model,
    });
  }

  const verified = await verifyResumeSemantics({
    draft: input.draft,
    ambiguity,
    generate,
  });

  if (!verified.ok) {
    return {
      draft: input.draft,
      ambiguity,
      meta: baseMeta({
        attempted: true,
        skipped: false,
        ambiguityReasons: ambiguity.reasons,
        llmSuccess: false,
        llmError: verified.error,
        fallbackDeterministic: true,
        latencyMs: verified.latencyMs ?? null,
        retries: verified.retries ?? 0,
        timedOut: Boolean(verified.timedOut),
        usage: verified.usage ?? null,
      }),
    };
  }

  const reconciled = reconcileSemanticVerification({
    draft: input.draft,
    verification: verified.data,
    sourceText: input.cleanedText,
  });

  const leaveEmptyCount = verified.data.decisions.filter(
    (d) => d.action === "leave_empty"
  ).length;
  const reclassifyCount = verified.data.decisions.filter(
    (d) => d.action === "reclassify"
  ).length;

  return {
    draft: reconciled.draft,
    ambiguity,
    meta: baseMeta({
      attempted: true,
      skipped: false,
      ambiguityReasons: ambiguity.reasons,
      llmSuccess: true,
      decisionCount: verified.data.decisions.length,
      accepted: reconciled.accepted,
      rejected: reconciled.rejected,
      unsupported: reconciled.unsupported,
      fallbackDeterministic: false,
      modelId: verified.modelId ?? modelHint,
      latencyMs: verified.latencyMs,
      retries: verified.retries,
      timedOut: verified.timedOut,
      usage: verified.usage,
      decisions: verified.data.decisions,
      reconcileNotes: reconciled.notes,
      leaveEmptyCount,
      reclassifyCount,
    }),
  };
}
