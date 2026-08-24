import "server-only";

import { getAppBaseUrl, hasExplicitAppBaseUrl } from "@/lib/config/app-url";

/**
 * CSRF mitigation for the public /apply state-changing routes (Phase-3 design
 * correction #2): Origin header must match an allowed origin, or the request
 * is rejected. Deliberately NOT a token/session-cookie CSRF scheme — the
 * submission token is the anonymous ownership credential, this check only
 * supplies the browser cross-site protection a session cookie would
 * normally get for free.
 *
 * ROOT CAUSE of the "Request origin not allowed" incident this replaced:
 * the previous version compared Origin only against `getAppBaseUrl()`
 * (the `APP_BASE_URL` env var / secret). That value is set once, by hand,
 * at deploy time, and drifts out of sync with reality in exactly the ways
 * production domains actually vary — www vs apex, an old domain after a
 * migration, a trailing detail, or simply never being updated after a
 * domain change. The public /apply client only ever calls this API
 * same-origin (relative `fetch("/api/public/applications/...")`), so the
 * *correct*, config-free check is: does the Origin header match the Host
 * this exact request actually arrived on? That can never drift, because
 * it's derived from the same request being validated, not from a separate
 * value someone has to remember to keep in sync — see Phase 8 guidance:
 * prefer eliminating unnecessary cross-origin complexity over expanding
 * CORS configuration.
 *
 * `APP_BASE_URL` is kept as an *additional* allowed origin (only when
 * explicitly set) purely as a defensive escape hatch — e.g. a load
 * balancer/CDN layer that legitimately fronts the app under a second
 * public hostname. It is no longer the only source of truth.
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
export function isAllowedOrigin(originHeader: string | null, request: Request): boolean {
  if (!originHeader) return true;

  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return false; // malformed Origin header — reject
  }

  const requestOrigin = deriveRequestOrigin(request);
  if (requestOrigin && origin.origin === requestOrigin) return true;

  if (hasExplicitAppBaseUrl()) {
    try {
      const configured = new URL(getAppBaseUrl());
      if (origin.origin === configured.origin) return true;
    } catch {
      // Malformed APP_BASE_URL doesn't invalidate the primary Host-based
      // check above — it just means this fallback contributes nothing.
    }
  }

  return false;
}

/**
 * The origin this exact request actually arrived on, per standard
 * reverse-proxy forwarded headers (AWS ALB/CloudFront and every common
 * proxy set X-Forwarded-Proto; X-Forwarded-Host is set by proxies that
 * front more than one hostname — falls back to the plain Host header for
 * a direct connection). Returns null only if neither header is present,
 * which should not happen for any real HTTP request.
 */
function deriveRequestOrigin(request: Request): string | null {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || new URL(request.url).protocol.replace(":", "") || "https";

  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}
