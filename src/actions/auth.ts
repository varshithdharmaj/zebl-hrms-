"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
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

export type PasswordActionState = {
  error?: string;
  success?: string;
};

export async function changePasswordAction(
  _prevState: PasswordActionState,
  formData: FormData
): Promise<PasswordActionState> {
  const session = await getSession();
  if (!session) {
    return { error: "Unauthorized." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation password do not match." };
  }

  if (newPassword.length < 3) {
    return { error: "New password must be at least 3 characters long." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { password: true },
    });

    if (!user || !user.password) {
      return { error: "User account not found." };
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      return { error: "Incorrect current password." };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: session.id },
      data: {
        password: passwordHash,
        sessionVersion: { increment: 1 },
      },
    });

    const clientIp = await getRequestClientIp();
    await writeAuditLog({
      entityType: "user",
      entityId: session.id,
      action: AUDIT_ACTIONS.AUTH_SESSION_INVALIDATED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: { reason: "password_changed", clientIp },
    });

    return { success: "Password changed successfully." };
  } catch (e) {
    console.error("Change password error:", e);
    return { error: "An error occurred while changing your password." };
  }
}
