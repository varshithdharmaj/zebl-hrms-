/**
 * Visibility scope resolved by RecruitmentScopeEngine.
 * Unrestricted = SA/HR. Otherwise filter by assignment sets.
 */
export type RecruitmentScopeMode = "unrestricted" | "assigned";

export type RecruitmentScope = {
  mode: RecruitmentScopeMode;
  /** Empty when unrestricted (do not apply jobId IN filter). */
  jobOpeningIds: readonly string[];
  applicationIds: readonly string[];
  candidateIds: readonly string[];
  /** Hiring-team / panel roles observed for this actor. */
  capabilities: {
    isRecruiterOnJob: boolean;
    isHiringManager: boolean;
    isTeamLead: boolean;
    isInterviewer: boolean;
  };
};

export function emptyRecruitmentScope(): RecruitmentScope {
  return {
    mode: "assigned",
    jobOpeningIds: [],
    applicationIds: [],
    candidateIds: [],
    capabilities: {
      isRecruiterOnJob: false,
      isHiringManager: false,
      isTeamLead: false,
      isInterviewer: false,
    },
  };
}

export function unrestrictedRecruitmentScope(): RecruitmentScope {
  return {
    mode: "unrestricted",
    jobOpeningIds: [],
    applicationIds: [],
    candidateIds: [],
    capabilities: {
      isRecruiterOnJob: true,
      isHiringManager: true,
      isTeamLead: true,
      isInterviewer: true,
    },
  };
}
