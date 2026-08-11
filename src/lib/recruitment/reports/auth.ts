import { getSessionOrThrow } from "@/lib/auth-guards";
import { canAccessRecruitmentAdministration } from "@/lib/recruitment/permissions/recruitment-test-manager";
import { PermissionError } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";

/**
 * HR, Super Admin, recruitment test managers, and scoped recruitment managers/recruiters may view reports.
 */
export async function requireRecruitmentReportSession(): Promise<SessionUser> {
  const session = await getSessionOrThrow();
  RecruitmentPermissionService.requireModuleEnabled();

  if (canAccessRecruitmentAdministration(session)) {
    return session;
  }

  try {
    const actor = toRecruitmentActor(session);
    await RecruitmentScopeEngine.assertModuleActor(actor);
    return session;
  } catch {
    throw new PermissionError("Not authorized to view recruitment reports.");
  }
}
