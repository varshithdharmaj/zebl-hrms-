import { describe, expect, it } from "vitest";
import { buildHiringFunnelCounts } from "@/lib/recruitment/dashboard/build-funnel-counts";
import { computeTimeToHireMetrics } from "@/lib/recruitment/analytics/compute-time-to-hire";

/**
 * Smoke: Job → Candidate → Interview → Offer → Conversion → Dashboard metrics
 * Pure pipeline over in-memory events (no DB). Ensures Sprint 3 metric builders
 * stay coherent across the hiring journey.
 */
describe("recruitment V1 hiring smoke (metrics)", () => {
  it("builds trustworthy funnel + TTH after a completed hire", () => {
    const stageCounts = {
      stage_resume_received: 1,
      stage_screening: 0,
      stage_hr_round: 0,
      stage_decision: 0,
      stage_offer: 0,
      stage_hired: 1,
    };

    const funnel = buildHiringFunnelCounts({
      stageCounts,
      offerSent: 1,
      offerAccepted: 1,
      pendingConversion: 0,
    });

    expect(funnel.applied).toBe(1);
    expect(funnel.hired).toBe(1);
    expect(funnel.offerAccepted).toBe(1);
    expect(funnel.pendingConversion).toBe(0);

    const appliedAt = new Date("2026-03-01T00:00:00.000Z");
    const interviewAt = new Date("2026-03-08T00:00:00.000Z");
    const offerSentAt = new Date("2026-03-15T00:00:00.000Z");
    const offerAcceptedAt = new Date("2026-03-17T00:00:00.000Z");
    const convertedAt = new Date("2026-03-22T00:00:00.000Z");

    const tth = computeTimeToHireMetrics([
      {
        applicationCreatedAt: appliedAt,
        firstInterviewAt: interviewAt,
        offerSentAt,
        offerAcceptedAt,
        convertedAt,
      },
    ]);

    expect(tth.sampleSize).toBe(1);
    expect(tth.totalTimeToHire).toBe(21);
    expect(tth.applicationToInterview).toBe(7);
    expect(tth.interviewToOffer).toBe(7);
    expect(tth.offerToHire).toBe(5);
  });
});
