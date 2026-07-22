import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toAppUserRole } from "@/lib/roles";
import type { SessionUser } from "@/lib/session";
import { createSessionToken } from "@/lib/session";
import { setSessionCookie } from "@/lib/auth/cookies";
import { setCachedSessionVersion } from "@/lib/session-version-cache";
import type { EstablishSessionInput } from "@/lib/auth/auth-types";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import { recordSuccessfulLogin } from "@/lib/security/login-history-service";

type UserWithEmployee = User & {
  employee?: { name: string; employeeStatus: string; isActive: boolean } | null;
};

export function buildSessionUser(user: UserWithEmployee): SessionUser {
  return {
    id: user.id,
    email: user.email,
    role: toAppUserRole(user.role),
    employeeId: user.employeeId,
    employeeName: user.employee?.name ?? null,
    sessionVersion: user.sessionVersion,
    authProvider: user.authProvider,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function loadUserForSession(userId: string): Promise<UserWithEmployee | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true },
  });
}

export async function establishSession(input: EstablishSessionInput): Promise<SessionUser | null> {
  const user = await loadUserForSession(input.userId);
  if (!user) return null;
  if (!user.isActive) return null;
  if (
    user.employee &&
    (user.employee.employeeStatus !== "Active" || !user.employee.isActive)
  ) {
    return null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      ...(input.authProvider ? { authProvider: input.authProvider } : {}),
    },
  });

  const sessionId = crypto.randomUUID();
  const sessionUser = { ...buildSessionUser(user), sessionId };
  setCachedSessionVersion(user.id, user.sessionVersion);
  const requestContext = await getRequestSecurityContext();
  await recordSuccessfulLogin({
    sessionId,
    userId: user.id,
    employeeId: user.employeeId,
    context: {
      ...requestContext,
      ipAddress: input.clientIp ?? requestContext.ipAddress,
    },
  });
  const token = await createSessionToken(sessionUser, sessionId);
  await setSessionCookie(token);
  return sessionUser;
}
