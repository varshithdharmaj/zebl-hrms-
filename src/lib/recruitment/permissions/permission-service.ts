import {
  canAccessPlatformAdministration,
  PermissionError,
  requirePermission,
} from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import type { RecruitmentActor } from "@/lib/recruitment/types/actor";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import {
  canAccessRecruitmentAdministration,
} from "@/lib/recruitment/permissions/recruitment-test-manager";
import {
  isRecruitmentConversionEnabled,
  isRecruitmentModuleEnabled,
  isRecruitmentOffersEnabled,
} from "@/lib/recruitment/config/feature-flags";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

/** Map session → recruitment actor (no extra fields). */
export function toRecruitmentActor(session: SessionUser): RecruitmentActor {
  return {
    userId: session.id,
    email: session.email,
    role: session.role,
    employeeId: session.employeeId,
    recruitmentOpsAccess: session.recruitmentOpsAccess === true,
  };
}

/**
 * RecruitmentPermissionService — resource capability checks.
 * Reuses platform role helpers; does not duplicate RBAC.
 * List visibility belongs to {@link RecruitmentScopeEngine}.
 */
export const RecruitmentPermissionService = {
  requireModuleEnabled(): void {
    if (!isRecruitmentModuleEnabled()) {
      throw new RecruitmentDomainError(
        "REC_FEATURE_DISABLED",
        "Recruitment module is disabled."
      );
    }
  },

  requireOffersEnabled(): void {
    this.requireModuleEnabled();
    if (!isRecruitmentOffersEnabled()) {
      throw new RecruitmentDomainError(
        "REC_FEATURE_DISABLED",
        "Recruitment offers feature is disabled."
      );
    }
  },

  requireConversionEnabled(): void {
    this.requireModuleEnabled();
    if (!isRecruitmentConversionEnabled()) {
      throw new RecruitmentDomainError(
        "REC_FEATURE_DISABLED",
        "Recruitment conversion feature is disabled."
      );
    }
  },

  /**
   * Recruitment administration: HR/SA, or the two recruitment test managers.
   * Not a general /admin gate — do not use outside Recruitment.
   */
  requireHrAdministration(session: SessionUser): void {
    if (!canAccessRecruitmentAdministration(session)) {
      throw new PermissionError("Unauthorized");
    }
  },

  requireSuperAdmin(session: SessionUser): void {
    requirePermission(session, canAccessPlatformAdministration);
  },

  canEditCompensation(session: SessionUser): boolean {
    return canAccessRecruitmentAdministration(session);
  },

  /** Job compensation band — SA/HR + recruitment test managers (ops validation). */
  canEditJobCompensation(session: SessionUser): boolean {
    return canAccessRecruitmentAdministration(session);
  },

  canViewJobCompensation(session: SessionUser): boolean {
    return canAccessRecruitmentAdministration(session);
  },

  canViewCompensation(session: SessionUser, isAssignedHiringManager: boolean): boolean {
    if (canAccessRecruitmentAdministration(session)) return true;
    return isAssignedHiringManager;
  },

  async assertCanManageJobs(session: SessionUser): Promise<void> {
    this.requireModuleEnabled();
    this.requireHrAdministration(session);
  },

  async assertCanManageCandidates(session: SessionUser): Promise<void> {
    this.requireModuleEnabled();
    this.requireHrAdministration(session);
  },

  /**
   * Discussion-only write access. Does not grant candidate edit / pipeline / offer rights.
   * HR/SA, or recruiter / hiring manager who can view the candidate.
   */
  async canWriteCandidateDiscussion(
    session: SessionUser,
    candidateId: string
  ): Promise<boolean> {
    if (!isRecruitmentModuleEnabled()) return false;
    const scope = await RecruitmentScopeEngine.getScope(session);
    const inScope =
      scope.mode === "unrestricted" || scope.candidateIds.includes(candidateId);
    if (!inScope) return false;
    if (canAccessRecruitmentAdministration(session)) return true;
    return (
      scope.capabilities.isRecruiterOnJob || scope.capabilities.isHiringManager
    );
  },

  async assertCanWriteCandidateDiscussion(
    session: SessionUser,
    candidateId: string
  ): Promise<void> {
    this.requireModuleEnabled();
    const allowed = await this.canWriteCandidateDiscussion(session, candidateId);
    if (!allowed) {
      throw new PermissionError(
        "Not allowed to add discussion notes for this candidate."
      );
    }
  },

  async assertCanManageApplications(session: SessionUser): Promise<void> {
    this.requireModuleEnabled();
    this.requireHrAdministration(session);
  },

  async assertCanViewApplication(
    session: SessionUser,
    applicationId: string
  ): Promise<void> {
    this.requireModuleEnabled();
    const actor = toRecruitmentActor(session);
    const allowed = await RecruitmentScopeEngine.canViewApplication(actor, applicationId);
    if (!allowed) throw new PermissionError("Application outside recruitment scope.");
  },

  async assertCanSubmitHiringDecision(
    session: SessionUser,
    applicationId: string
  ): Promise<void> {
    this.requireModuleEnabled();
    this.requireHrAdministration(session);
    const scope = await RecruitmentScopeEngine.getScope(session);
    RecruitmentScopeEngine.assertApplicationInScope(scope, applicationId);
  },
};
