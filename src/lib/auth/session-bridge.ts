import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toAppUserRole } from "@/lib/roles";
import type { SessionUser } from "@/lib/session";
import { createSessionToken } from "@/lib/session";
import { setSessionCookie } from "@/lib/auth/cookies";
import { setCachedSessionVersion } from "@/lib/session-version-cache";
import type { EstablishSessionInput } from "@/lib/auth/auth-types";

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

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      ...(input.authProvider ? { authProvider: input.authProvider } : {}),
    },
  });

  const sessionUser = buildSessionUser(user);
  setCachedSessionVersion(user.id, user.sessionVersion);
  const token = await createSessionToken(sessionUser);
  await setSessionCookie(token);
  return sessionUser;
}
