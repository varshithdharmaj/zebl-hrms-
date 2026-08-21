export const PUBLIC_PATHS = [
  "/login",
  "/approve",
  "/api/approve",
  "/api/auth/microsoft",
  "/api/integrations/teams",
  "/api/health",
  "/apply",
  "/api/public/applications",
] as const;

/** Bearer-secret ops routes — session optional; handlers enforce authorizeCronOrAdmin. */
export const CRON_PUBLIC_PATHS = [
  "/api/notifications/process",
  "/api/integrations/process",
  "/api/analytics/process",
  "/api/health/deep",
  "/api/integrations/attendance/ingest",
] as const;

export const APPROVAL_PUBLIC_PATHS = ["/approve", "/api/approve"] as const;

/** Anonymous candidate-facing career portal — never bounce a logged-in HR
 * session away from these (an HR user previewing /apply, or a candidate who
 * happens to share a browser with a staff session, must still see the
 * public page, not their dashboard). */
export const APPLY_PUBLIC_PATHS = ["/apply", "/api/public/applications"] as const;

/**
 * Self-service pages HR/Super Admin may open on their own Employee record
 * (see `canAccessOwnWorkspace`). Deliberately excludes `/employee/team`,
 * `/employee/tickets`, `/employee/approvals` — those stay Manager/Employee-only.
 */
export const OWN_WORKSPACE_SELF_SERVICE_PATHS = [
  "/employee/dashboard",
  "/employee/attendance",
  "/employee/leaves",
  "/employee/profile",
] as const;

function matchesPathPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPublicPath(pathname: string): boolean {
  return (
    matchesPathPrefix(pathname, PUBLIC_PATHS) ||
    matchesPathPrefix(pathname, CRON_PUBLIC_PATHS)
  );
}

export function isCronPublicPath(pathname: string): boolean {
  return matchesPathPrefix(pathname, CRON_PUBLIC_PATHS);
}

export function isApprovalPublicPath(pathname: string): boolean {
  return matchesPathPrefix(pathname, APPROVAL_PUBLIC_PATHS);
}

export function isApplyPublicPath(pathname: string): boolean {
  return matchesPathPrefix(pathname, APPLY_PUBLIC_PATHS);
}

export function isOwnWorkspaceSelfServicePath(pathname: string): boolean {
  return matchesPathPrefix(pathname, OWN_WORKSPACE_SELF_SERVICE_PATHS);
}
