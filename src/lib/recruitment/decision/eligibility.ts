import { HiringDecisionOutcome } from "@/generated/prisma/enums";

export const OFFER_ELIGIBLE_DECISION_OUTCOMES: readonly HiringDecisionOutcome[] = [
  HiringDecisionOutcome.strong_hire,
  HiringDecisionOutcome.hire,
];

export function isOfferEligibleDecisionOutcome(
  outcome: HiringDecisionOutcome
): boolean {
  return (
    outcome === HiringDecisionOutcome.strong_hire ||
    outcome === HiringDecisionOutcome.hire
  );
}

export function canCreateOfferFromDecisionState(
  requireDecisionForOffer: boolean,
  outcome: HiringDecisionOutcome | null | undefined
): boolean {
  if (!requireDecisionForOffer) return true;
  if (!outcome) return false;
  return isOfferEligibleDecisionOutcome(outcome);
}
