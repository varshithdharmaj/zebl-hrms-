import { cache } from "react";
import { HiringTeamRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import {
  canAccessHRAdministration,
  PermissionError,
} from "@/lib/permissions";
import type { RecruitmentActor } from "@/lib/recruitment/types/actor";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import {
  emptyRecruitmentScope,
  unrestrictedRecruitmentScope,
} from "@/lib/recruitment/types/scope";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

/**
 * RecruitmentScopeEngine — single authority for recruitment query visibility.
 *
 * Pattern mirrors {@link PeopleScopeEngine}: resolve once per request (React cache),
 * never scatter managerId/employeeId filters in feature queries.
 *
 * Unrestricted for SA/HR via existing {@link canAccessHRAdministration}.
 * Assigned scope from HiringTeamMember + InterviewPanelist (+ application manager).
 */
async function resolveScopeUncached(actor: RecruitmentActor): Promise<RecruitmentScope> {
  if (canAccessHRAdministration(actor.role)) {
    return unrestrictedRecruitmentScope();
  }

  if (actor.employeeId == null) {
    return emptyRecruitmentScope();
  }

  const employeeId = actor.employeeId;

  const [teamRows, panelRows, managedApps] = await Promise.all([
    prisma.hiringTeamMember.findMany({
      where: { employeeId },
      select: { jobOpeningId: true, role: true },
    }),
    prisma.interviewPanelist.findMany({
      where: { employeeId },
      select: {
        interview: {
          select: {
            applicationId: true,
            application: { select: { candidateId: true, jobOpeningId: true } },
          },
        },
      },
    }),
    prisma.application.findMany({
      where: { assignedManagerEmployeeId: employeeId, deletedAt: null },
      select: { id: true, candidateId: true, jobOpeningId: true },
    }),
  ]);

  const jobOpeningIds = new Set<string>();
  const applicationIds = new Set<string>();
  const candidateIds = new Set<string>();

  let isRecruiterOnJob = false;
  let isHiringManager = false;
  let isTeamLead = false;

  for (const row of teamRows) {
    jobOpeningIds.add(row.jobOpeningId);
    if (row.role === HiringTeamRole.recruiter) isRecruiterOnJob = true;
    if (row.role === HiringTeamRole.hiring_manager) isHiringManager = true;
    if (row.role === HiringTeamRole.team_lead) isTeamLead = true;
  }

  const isInterviewer = panelRows.length > 0;
  for (const row of panelRows) {
    applicationIds.add(row.interview.applicationId);
    candidateIds.add(row.interview.application.candidateId);
    jobOpeningIds.add(row.interview.application.jobOpeningId);
  }

  for (const app of managedApps) {
    applicationIds.add(app.id);
    candidateIds.add(app.candidateId);
    jobOpeningIds.add(app.jobOpeningId);
    isHiringManager = true;
  }

  // Expand applications for team-assigned jobs (Phase 1: ids only for scope membership checks).
  if (jobOpeningIds.size > 0) {
    const appsOnJobs = await prisma.application.findMany({
      where: {
        jobOpeningId: { in: [...jobOpeningIds] },
        deletedAt: null,
      },
      select: { id: true, candidateId: true },
    });
    for (const app of appsOnJobs) {
      applicationIds.add(app.id);
      candidateIds.add(app.candidateId);
    }
  }

  return {
    mode: "assigned",
    jobOpeningIds: [...jobOpeningIds],
    applicationIds: [...applicationIds],
    candidateIds: [...candidateIds],
    capabilities: {
      isRecruiterOnJob,
      isHiringManager,
      isTeamLead,
      isInterviewer,
    },
  };
}

/** Request-deduped scope resolution (PeopleScopeEngine-style). */
export const resolveRecruitmentScope = cache(async (actor: RecruitmentActor) => {
  return resolveScopeUncached(actor);
});

function assertScoped(
  scope: RecruitmentScope,
  inSet: boolean,
  message: string
): void {
  if (scope.mode === "unrestricted") return;
  if (!inSet) {
    throw new RecruitmentDomainError("REC_FORBIDDEN_SCOPE", message);
  }
}

export const RecruitmentScopeEngine = {
  resolveScope: resolveRecruitmentScope,

  async getScope(session: SessionUser): Promise<RecruitmentScope> {
    const actor = {
      userId: session.id,
      email: session.email,
      role: session.role,
      employeeId: session.employeeId,
    };
    return resolveRecruitmentScope(actor);
  },

  assertApplicationInScope(scope: RecruitmentScope, applicationId: string): void {
    if (scope.mode === "unrestricted") return;
    if (!scope.applicationIds.includes(applicationId)) {
      throw new RecruitmentDomainError("REC_FORBIDDEN_SCOPE", "Application outside recruitment scope.");
    }
  },

  assertCandidateInScope(scope: RecruitmentScope, candidateId: string): void {
    if (scope.mode === "unrestricted") return;
    if (!scope.candidateIds.includes(candidateId)) {
      throw new RecruitmentDomainError("REC_FORBIDDEN_SCOPE", "Candidate outside recruitment scope.");
    }
  },

  async canViewJob(actor: RecruitmentActor, jobOpeningId: string): Promise<boolean> {
    const scope = await resolveRecruitmentScope(actor);
    if (scope.mode === "unrestricted") return true;
    return scope.jobOpeningIds.includes(jobOpeningId);
  },

  async canViewCandidate(actor: RecruitmentActor, candidateId: string): Promise<boolean> {
    const scope = await resolveRecruitmentScope(actor);
    if (scope.mode === "unrestricted") return true;
    return scope.candidateIds.includes(candidateId);
  },

  async canViewApplication(actor: RecruitmentActor, applicationId: string): Promise<boolean> {
    const scope = await resolveRecruitmentScope(actor);
    if (scope.mode === "unrestricted") return true;
    return scope.applicationIds.includes(applicationId);
  },

  async canManageJob(actor: RecruitmentActor, jobOpeningId?: string): Promise<boolean> {
    if (!canAccessHRAdministration(actor.role)) return false;
    if (!jobOpeningId) return true;
    return RecruitmentScopeEngine.canViewJob(actor, jobOpeningId);
  },

  async canManageCandidate(actor: RecruitmentActor, candidateId?: string): Promise<boolean> {
    if (!canAccessHRAdministration(actor.role)) return false;
    if (!candidateId) return true;
    return RecruitmentScopeEngine.canViewCandidate(actor, candidateId);
  },

  async canManageApplication(actor: RecruitmentActor, applicationId?: string): Promise<boolean> {
    if (!canAccessHRAdministration(actor.role)) return false;
    if (!applicationId) return true;
    return RecruitmentScopeEngine.canViewApplication(actor, applicationId);
  },

  async canInterview(actor: RecruitmentActor, applicationId: string): Promise<boolean> {
    if (canAccessHRAdministration(actor.role)) return true;
    const scope = await resolveRecruitmentScope(actor);
    return (
      scope.capabilities.isInterviewer &&
      scope.applicationIds.includes(applicationId)
    );
  },

  async assertCanViewJob(actor: RecruitmentActor, jobOpeningId: string): Promise<void> {
    const scope = await resolveRecruitmentScope(actor);
    assertScoped(scope, scope.jobOpeningIds.includes(jobOpeningId), "Job outside recruitment scope.");
  },

  async assertCanViewApplication(
    actor: RecruitmentActor,
    applicationId: string
  ): Promise<void> {
    const scope = await resolveRecruitmentScope(actor);
    assertScoped(
      scope,
      scope.applicationIds.includes(applicationId),
      "Application outside recruitment scope."
    );
  },

  async assertModuleActor(actor: RecruitmentActor): Promise<RecruitmentScope> {
    const scope = await resolveRecruitmentScope(actor);
    if (scope.mode === "unrestricted") return scope;
    const empty =
      scope.jobOpeningIds.length === 0 &&
      scope.applicationIds.length === 0 &&
      scope.candidateIds.length === 0;
    if (empty) {
      throw new PermissionError("No recruitment assignment.");
    }
    return scope;
  },
};
