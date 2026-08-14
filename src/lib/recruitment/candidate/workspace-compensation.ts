/**
 * Server-side shaping: strip candidate CTC fields when unauthorized.
 * Prefer this over client-only hiding so values never reach the UI tree.
 */
export function redactCandidateCompensationFields<
  T extends {
    currentCtc?: string | number | null;
    expectedCtc?: string | number | null;
  },
>(candidate: T, canViewCompensation: boolean): T {
  if (canViewCompensation) return candidate;
  return {
    ...candidate,
    currentCtc: null,
    expectedCtc: null,
  };
}

export function redactOfferCtc(
  ctc: number | string | null | undefined,
  canViewCompensation: boolean
): number | null {
  if (!canViewCompensation) return null;
  if (ctc == null) return null;
  const n = typeof ctc === "number" ? ctc : Number(ctc);
  return Number.isFinite(n) ? n : null;
}
