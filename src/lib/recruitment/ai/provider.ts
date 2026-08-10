import type {
  CandidateEnrichmentContext,
  CandidateEnrichmentOutput,
} from "./types";
import type {
  RecoveryFieldKey,
  ResumeFieldRecoveryContext,
} from "./recovery-types";

export type AiGenerateResult =
  | { ok: true; data: CandidateEnrichmentOutput; modelId: string; rawText?: string }
  | { ok: false; error: string; retryable?: boolean };

export type RecoveryProposalItem = {
  field: RecoveryFieldKey;
  value: unknown;
  confidence: "high" | "medium";
  evidence: string;
};

export type AiRecoveryGenerateResult =
  | {
      ok: true;
      data: RecoveryProposalItem[];
      modelId: string;
      rawText?: string;
    }
  | { ok: false; error: string; retryable?: boolean };

export type AiProvider = {
  readonly id: string;
  generateCandidateEnrichment(
    context: CandidateEnrichmentContext
  ): Promise<AiGenerateResult>;
  generateResumeFieldRecovery(
    context: ResumeFieldRecoveryContext
  ): Promise<AiRecoveryGenerateResult>;
};

export type AiProviderFactory = () => AiProvider;
