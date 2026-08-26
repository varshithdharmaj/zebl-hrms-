import { NextResponse } from "next/server";
import { isMicrosoftAuthEnabled } from "@/lib/auth/auth-config";
import {
  createOAuthPendingState,
  buildMicrosoftAuthorizationUrl,
} from "@/lib/auth/providers/microsoft-provider";
import {
  oauthPendingCookieOptions,
  signOAuthPending,
  sanitizeReturnTo,
} from "@/lib/auth/oauth-state";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";

export async function GET(request: Request) {
  if (!isMicrosoftAuthEnabled()) {
    return NextResponse.redirect(
      new URL("/login?error=sso_disabled", request.url)
    );
  }

  const url = new URL(request.url);
  const clientIp = getClientIp(request.headers) ?? "unknown";
  const limit = checkRateLimit(`sso-start:${clientIp}`, 30, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.redirect(new URL("/login?error=rate_limited", request.url));
  }

  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const pending = createOAuthPendingState(returnTo);
  const signed = await signOAuthPending(pending);
  const redirectTo = await buildMicrosoftAuthorizationUrl(pending);

  const response = NextResponse.redirect(redirectTo);
  response.cookies.set(oauthPendingCookieOptions(signed));
  return response;
}
