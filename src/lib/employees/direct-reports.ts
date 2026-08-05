import { cache } from "react";
import { PeopleScopeEngine } from "@/lib/people-scope/engine";

/**
 * Whether the employee manages anyone (line-manager nav affordance).
 * Request-memoized — safe to call from multiple server components in one RSC request.
 *
 * Implementation: delegates to {@link PeopleScopeEngine.isLineManager} (PRD DIRECT
 * eligibility: active + non-terminal reports). Public API unchanged.
 */
export const employeeHasDirectReports = cache(async (employeeId: number): Promise<boolean> => {
  return PeopleScopeEngine.isLineManager(employeeId);
});
