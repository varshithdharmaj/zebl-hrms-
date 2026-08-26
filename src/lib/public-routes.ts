export const PUBLIC_PATHS = [
  "/login",
  "/approve",
  "/api/approve",
  "/api/auth/microsoft",
  "/api/integrations/teams",
  "/api/health",
] as const;

export const APPROVAL_PUBLIC_PATHS = ["/approve", "/api/approve"] as const;

function matchesPathPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPublicPath(pathname: string): boolean {
  return matchesPathPrefix(pathname, PUBLIC_PATHS);
}

export function isApprovalPublicPath(pathname: string): boolean {
  return matchesPathPrefix(pathname, APPROVAL_PUBLIC_PATHS);
}
