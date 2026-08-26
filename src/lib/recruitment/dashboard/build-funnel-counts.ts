import type { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { StageCategory } from "@/generated/prisma/enums";
import { PIPELINE_STAGE_CATEGORY } from "@/lib/recruitment/shared/pipeline-stage-groups";

export type HiringFunnelCounts = {
  applied: number;
  screening: number;
  interview: number;
  selected: number;
  offerSent: number;
  offerAccepted: number;
  pendingConversion: number;
  hired: number;
};

/**
 * Buckets `stage_<RecruitmentPipelineStage>` count keys into StageCategory
 * totals via PIPELINE_STAGE_CATEGORY — the funnel keys off category, not
 * per-value comparisons, so a job's custom/relabeled stage still rolls up
 * correctly as long as it carries a category.
 */
function categoryTotals(stageCounts: Record<string, number>): Record<StageCategory, number> {
  const totals: Record<StageCategory, number> = {
    [StageCategory.APPLIED]: 0,
    [StageCategory.SCREENING]: 0,
    [StageCategory.ASSESSMENT]: 0,
    [StageCategory.INTERVIEW]: 0,
    [StageCategory.DECISION]: 0,
    [StageCategory.OFFER]: 0,
    [StageCategory.JOINED]: 0,
    [StageCategory.REJECTED]: 0,
  };
  for (const [rawKey, value] of Object.entries(stageCounts)) {
    const key = (rawKey.startsWith("stage_") ? rawKey.slice("stage_".length) : rawKey) as RecruitmentPipelineStage;
    const category = PIPELINE_STAGE_CATEGORY[key];
    if (category) totals[category] += value;
  }
  return totals;
}

/**
 * Map application stage_* count keys (+ offer/conversion totals) into the V1 funnel.
 * Pure function — no DB access.
 */
export function buildHiringFunnelCounts(input: {
  stageCounts: Record<string, number>;
  offerSent?: number;
  offerAccepted?: number;
  pendingConversion?: number;
}): HiringFunnelCounts {
  const totals = categoryTotals(input.stageCounts);

  return {
    applied: totals[StageCategory.APPLIED],
    // SCREENING + ASSESSMENT combined — matches the pre-category funnel's
    // single "screening" bucket (screening + assessment stages together).
    screening: totals[StageCategory.SCREENING] + totals[StageCategory.ASSESSMENT],
    interview: totals[StageCategory.INTERVIEW],
    selected: totals[StageCategory.DECISION],
    offerSent: input.offerSent ?? totals[StageCategory.OFFER],
    offerAccepted: input.offerAccepted ?? 0,
    pendingConversion: input.pendingConversion ?? 0,
    hired: totals[StageCategory.JOINED],
  };
}

export const FUNNEL_LABELS: Array<{ key: keyof HiringFunnelCounts; label: string }> = [
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "selected", label: "Selected" },
  { key: "offerSent", label: "Offer Sent" },
  { key: "offerAccepted", label: "Offer Accepted" },
  { key: "pendingConversion", label: "Pending Conversion" },
  { key: "hired", label: "Hired" },
];
