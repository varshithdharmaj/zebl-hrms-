import { cache } from "react";
import { employeeHasDirectReports } from "@/lib/employees/direct-reports";

/**
 * Presentation context for My Team / Approvals nav (not an authorization gate).
 * Consumed by the employee shell sidebar (Phase 3).
 */
export type MyTeamNavContext = {
  employeeId: number;
  /** PRD line-manager eligibility via PeopleScopeEngine DIRECT scope. */
  isLineManager: boolean;
  /** Show Team Approvals link in the employee sidebar. */
  showApprovalsNav: boolean;
  /**
   * Show the My Team nav group when Phase 3 wires UI.
   * V1: same as isLineManager (hiring / pending-only extensions later).
   */
  showMyTeamGroup: boolean;
};

/**
 * Builds My Team nav context for a linked employee.
 * Request-memoized; shares eligibility with {@link employeeHasDirectReports}.
 */
export const resolveMyTeamNavContext = cache(
  async (employeeId: number): Promise<MyTeamNavContext> => {
    const isLineManager = await employeeHasDirectReports(employeeId);
    return {
      employeeId,
      isLineManager,
      showApprovalsNav: isLineManager,
      showMyTeamGroup: isLineManager,
    };
  }
);
