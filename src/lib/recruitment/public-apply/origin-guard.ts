import "server-only";

import { getAppBaseUrl } from "@/lib/config/app-url";

/**
 * CSRF mitigation for the public /apply state-changing routes (Phase-3 design
 * correction #2): Origin header must match the configured application origin,
 * or the request is rejected. Deliberately NOT a token/session-cookie CSRF
 * scheme — the submission token is the anonymous ownership credential, this
 * check only supplies the browser cross-site protection a session cookie
 * would normally get for free.
 *
 * Policy for a missing Origin header: allow. Same-origin browser navigations
 * and same-origin fetches always send Origin on state-changing requests in
 * modern browsers; a missing header here means either a legitimate
 * non-browser caller (health checks, future server-to-server integration) or
 * an older browser/proxy that strips it — rejecting those outright would
 * silently break real usage for a mitigation whose actual target is
 * cross-site browser requests, which always DO send Origin. This is a
 * deliberate choice, not an oversight — revisit if abuse is observed.
 */
export function isAllowedOrigin(originHeader: string | null): boolean {
  if (!originHeader) return true;

  let allowed: URL;
  try {
    allowed = new URL(getAppBaseUrl());
  } catch {
    return true; // misconfigured APP_BASE_URL must not brick the whole public flow
  }

  try {
    const origin = new URL(originHeader);
    return origin.origin === allowed.origin;
  } catch {
    return false; // malformed Origin header — reject
  }
}
