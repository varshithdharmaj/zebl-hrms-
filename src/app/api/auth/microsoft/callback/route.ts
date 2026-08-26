import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthProvider } from "@prisma/client";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getDefaultRedirect } from "@/lib/auth";
import { isMicrosoftAuthEnabled } from "@/lib/auth/auth-config";
import { handleMicrosoftCallback } from "@/lib/auth/providers/microsoft-provider";
import {
  OAUTH_PENDING_COOKIE,
  verifyOAuthPending,
  clearOAuthPendingCookieOptions,
  sanitizeReturnTo,
} from "@/lib/auth/oauth-state";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/request-meta";

function loginErrorRedirect(request: Request, error: string, description?: string) {
  const login = new URL("/login", request.url);
  login.searchParams.set("error", error);
  if (description) login.searchParams.set("error_description", description.slice(0, 240));
  return NextResponse.redirect(login);
}

export async function GET(request: Request) {
  if (!isMicrosoftAuthEnabled()) {
    return loginErrorRedirect(request, "sso_disabled");
  }

  const clientIp = getClientIp(request.headers);
  const userAgent = getUserAgent(request.headers);
  const limit = checkRateLimit(`sso-callback:${clientIp ?? "unknown"}`, 40, 15 * 60 * 1000);
  if (!limit.allowed) {
    return loginErrorRedirect(request, "rate_limited");
  }

  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    await writeAuditLog({
      entityType: "auth",
      entityId: "microsoft",
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      metadata: {
        provider: "microsoft",
        reason: oauthError,
        clientIp,
        userAgent,
      },
    });
    return loginErrorRedirect(
      request,
      "sso_denied",
      url.searchParams.get("error_description") ?? oauthError
    );
  }

  const cookieStore = await cookies();
  const pendingRaw = cookieStore.get(OAUTH_PENDING_COOKIE)?.value;
  if (!pendingRaw) {
    return loginErrorRedirect(request, "sso_denied", "Sign-in session expired. Please try again.");
  }

  const pending = await verifyOAuthPending(pendingRaw);
  if (!pending) {
    return loginErrorRedirect(request, "sso_denied", "Invalid sign-in state. Please try again.");
  }

  const result = await handleMicrosoftCallback(request, pending);

  const response = result.ok
    ? NextResponse.redirect(new URL(getDefaultRedirect(result.user.role), request.url))
    : loginErrorRedirect(request, result.redirectError, result.redirectDescription);

  response.cookies.set(clearOAuthPendingCookieOptions());

  if (result.ok) {
    await writeAuditLog({
      entityType: "user",
      entityId: result.user.id,
      action: AUDIT_ACTIONS.AUTH_SSO_LOGIN_SUCCESS,
      actorUserId: result.user.id,
      actorEmail: result.user.email,
      metadata: {
        provider: AuthProvider.microsoft,
        clientIp,
        userAgent,
        correlationId: result.correlationId,
        returnTo: sanitizeReturnTo(pending.returnTo),
      },
    });
  } else {
    await writeAuditLog({
      entityType: "auth",
      entityId: "microsoft",
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      metadata: {
        provider: "microsoft",
        reason: result.redirectError,
        description: result.redirectDescription,
        clientIp,
        userAgent,
      },
    });
  }

  return response;
}
