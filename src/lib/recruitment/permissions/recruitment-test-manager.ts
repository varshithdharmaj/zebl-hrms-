/**
 * Permanent Recruitment ops capability for selected employee users.
 *
 * Authorization source: {@link SessionUser.recruitmentOpsAccess} (persisted on User).
 * Seed identifiers (emails/codes) are for upsert only — not runtime auth.
 *
 * Does not change UserRole, HR, Super Admin, or general /admin access.
 */
import { canAccessHRAdministration } from "@/lib/permissions";
import type { AppUserRole } from "@/lib/roles";

/** Stable seed identifiers — NOT used for runtime authorization. */
export const RECRUITMENT_TEST_MANAGER_EMPLOYEE_CODES = [
  "TEST-MGR-01",
  "TEST-MGR-02",
] as const;

/** Stable seed identifiers — NOT used for runtime authorization. */
export const RECRUITMENT_TEST_MANAGER_EMAILS = [
  "mgr1.test@zebl.local",
  "mgr2.test@zebl.local",
] as const;

export type RecruitmentOpsSession = {
  role: AppUserRole;
  recruitmentOpsAccess?: boolean;
};

/**
 * Whether the session carries the permanent Recruitment ops capability.
 * Missing/legacy JWT claims default to false.
 */
export function hasRecruitmentOpsAccess(
  session: Pick<RecruitmentOpsSession, "recruitmentOpsAccess">
): boolean {
  return session.recruitmentOpsAccess === true;
}

/**
 * HR / Super Admin OR User.recruitmentOpsAccess.
 * Use for Recruitment module authorization only — never for general /admin.
 */
export function canAccessRecruitmentAdministration(
  session: RecruitmentOpsSession
): boolean {
  if (canAccessHRAdministration(session.role)) return true;
  return hasRecruitmentOpsAccess(session);
}

/**
 * @deprecated Prefer {@link hasRecruitmentOpsAccess}. Kept as alias for call-site clarity
 * during permanentization (same semantics: DB-backed flag, not email allowlist).
 */
export function isRecruitmentTestManager(
  session: Pick<RecruitmentOpsSession, "recruitmentOpsAccess">
): boolean {
  return hasRecruitmentOpsAccess(session);
}

/** Path carve-out for middleware — recruitment workspace only under /admin. */
export function isAdminRecruitmentPath(pathname: string): boolean {
  return (
    pathname === "/admin/recruitment" ||
    pathname.startsWith("/admin/recruitment/")
  );
}
