import { RecruitmentPipelineStage } from "@/generated/prisma/enums";

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

const SCREENING = new Set<string>([
  RecruitmentPipelineStage.screening,
  RecruitmentPipelineStage.assessment,
]);

const INTERVIEW = new Set<string>([
  RecruitmentPipelineStage.hr_round,
  RecruitmentPipelineStage.technical_round,
  RecruitmentPipelineStage.team_lead_round,
  RecruitmentPipelineStage.manager_round,
  RecruitmentPipelineStage.client_round,
  RecruitmentPipelineStage.reference_check,
]);

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
  const stage = (key: string) => input.stageCounts[`stage_${key}`] ?? input.stageCounts[key] ?? 0;

  let screening = 0;
  let interview = 0;
  for (const [rawKey, value] of Object.entries(input.stageCounts)) {
    const key = rawKey.startsWith("stage_") ? rawKey.slice("stage_".length) : rawKey;
    if (SCREENING.has(key)) screening += value;
    if (INTERVIEW.has(key)) interview += value;
  }

  return {
    applied: stage(RecruitmentPipelineStage.resume_received),
    screening,
    interview,
    selected: stage(RecruitmentPipelineStage.decision),
    offerSent:
      input.offerSent ??
      stage(RecruitmentPipelineStage.offer),
    offerAccepted: input.offerAccepted ?? 0,
    pendingConversion: input.pendingConversion ?? 0,
    hired: stage(RecruitmentPipelineStage.hired),
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
