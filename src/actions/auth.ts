"use server";

import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  getDefaultRedirect,
  getRequestClientIp,
  getSession,
  invalidateUserSessionsWithAudit,
} from "@/lib/auth";
import { authenticateLocalUser } from "@/lib/auth/providers/local-provider";
import { establishSession } from "@/lib/auth/session-bridge";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

export type AuthState = {
  error?: string;
};

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function loginAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const clientIp = await getRequestClientIp();
  const rateKey = `login:${clientIp}:${email.toLowerCase()}`;
  const limit = checkRateLimit(rateKey, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);

  if (!limit.allowed) {
    await writeAuditLog({
      entityType: "auth",
      entityId: email.toLowerCase(),
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      actorEmail: email.toLowerCase(),
      metadata: { reason: "rate_limited", clientIp },
    });
    const minutes = Math.ceil(limit.retryAfterMs / 60000);
    return { error: `Too many login attempts. Try again in ${minutes} minute(s).` };
  }

  const auth = await authenticateLocalUser({ email, password, clientIp });
  if (!auth.ok) {
    await writeAuditLog({
      entityType: "auth",
      entityId: email.toLowerCase(),
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      actorEmail: email.toLowerCase(),
      metadata: { reason: auth.code, clientIp, provider: "local" },
    });
    return { error: auth.message };
  }

  resetRateLimit(rateKey);

  const sessionUser = await establishSession({
    userId: auth.user.id,
    authProvider: auth.user.authProvider,
    clientIp,
  });

  if (!sessionUser) {
    return { error: "Unable to create session." };
  }

  await writeAuditLog({
    entityType: "user",
    entityId: sessionUser.id,
    action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    actorUserId: sessionUser.id,
    actorEmail: sessionUser.email,
    metadata: { authProvider: sessionUser.authProvider, clientIp, provider: "local" },
  });

  redirect(getDefaultRedirect(sessionUser.role));
}

export async function logoutAction() {
  const session = await getSession();
  const clientIp = await getRequestClientIp();
  if (session) {
    await invalidateUserSessionsWithAudit(session.id, {
      userId: session.id,
      email: session.email,
    }, "logout");
    await writeAuditLog({
      entityType: "user",
      entityId: session.id,
      action: AUDIT_ACTIONS.AUTH_LOGOUT,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: { authProvider: session.authProvider, clientIp },
    });
  }
  await clearSessionCookie();
  redirect("/login");
}
