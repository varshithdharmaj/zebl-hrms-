import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  type SessionUser,
} from "@/lib/session";
import { getDefaultRedirectForRole } from "@/lib/routing";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { buildSessionUser } from "@/lib/auth/session-bridge";
import { authenticateLocalUser } from "@/lib/auth/providers/local-provider";
import { setCachedSessionVersion } from "@/lib/session-version-cache";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import {
  closeAllUserSessions,
  findActiveCurrentLoginSession,
  touchLoginSessionActivityIfStale,
} from "@/lib/security/login-history-service";

export type { SessionUser };

export { createSessionToken, getDefaultRedirectForRole as getDefaultRedirect };
export { setSessionCookie, clearSessionCookie };

/** Resolves a verified JWT into a SessionUser. Exported for unit tests / measurement. */
export async function resolveSessionFromToken(token: string): Promise<SessionUser | null> {
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // User + login-session SELECTs are independent (JWT already has id + jti).
  // Run them concurrently; keep all validation and activity touch afterward.
  let user: Awaited<
    ReturnType<
      typeof prisma.user.findUnique<{
        where: { id: string };
        include: { employee: true };
      }>
    >
  > = null;
  let loginSession: { lastActivityAt: Date } | null = null;

  try {
    const userPromise = prisma.user.findUnique({
      where: { id: payload.id },
      include: { employee: true },
    });

    if (payload.sessionId) {
      const [userResult, sessionResult] = await Promise.all([
        userPromise.then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error })
        ),
        findActiveCurrentLoginSession(payload.sessionId, payload.id).then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error })
        ),
      ]);

      if (!userResult.ok) {
        console.error(
          "[zebl] Session lookup failed — check DATABASE_URL (Neon pooled URL on Vercel).",
          userResult.error instanceof Error ? userResult.error.message : userResult.error
        );
        return null;
      }
      // Preserve prior behavior: login-session DB failures propagate (were outside the user try/catch).
      if (!sessionResult.ok) {
        throw sessionResult.error;
      }

      user = userResult.value;
      loginSession = sessionResult.value;
    } else {
      user = await userPromise;
    }
  } catch (e) {
    // Session-path DB failures rethrow; user-only path returns null (prior behavior).
    if (payload.sessionId) {
      throw e;
    }
    console.error(
      "[zebl] Session lookup failed — check DATABASE_URL (Neon pooled URL on Vercel).",
      e instanceof Error ? e.message : e
    );
    return null;
  }

  if (!user) return null;
  if (!user.isActive) return null;
  if (user.sessionVersion !== payload.sessionVersion) return null;

  if (payload.sessionId) {
    if (!loginSession) return null;
    // Activity touch only after user + session validation (never concurrent with checks).
    await touchLoginSessionActivityIfStale(
      payload.sessionId,
      user.id,
      loginSession.lastActivityAt
    );
  }

  setCachedSessionVersion(user.id, user.sessionVersion);
  return { ...buildSessionUser(user), sessionId: payload.sessionId };
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return resolveSessionFromToken(token);
});

/** JWT-only check for Edge middleware (no DB). Pair with session-version cache. */
export async function getSessionFromToken(token: string): Promise<SessionUser | null> {
  return verifySessionToken(token);
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  await closeAllUserSessions(userId, "revoked");
  setCachedSessionVersion(userId, user.sessionVersion);
}

export async function invalidateUserSessionsWithAudit(
  userId: string,
  actor?: { userId: string; email: string },
  reason?: string
): Promise<void> {
  await invalidateUserSessions(userId);
  await writeAuditLog({
    entityType: "user",
    entityId: userId,
    action: AUDIT_ACTIONS.AUTH_SESSION_INVALIDATED,
    actorUserId: actor?.userId,
    actorEmail: actor?.email,
    metadata: { reason: reason ?? "session_invalidated" },
  });
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const result = await authenticateLocalUser({ email, password });
  return result.ok ? result.user : null;
}

export function getClientIpFromHeaders(headerStore: Headers): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return headerStore.get("x-real-ip") ?? "unknown";
}

export async function getRequestClientIp(): Promise<string> {
  const headerStore = await headers();
  return getClientIpFromHeaders(headerStore);
}
