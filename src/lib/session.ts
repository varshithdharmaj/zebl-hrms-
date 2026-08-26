import { SignJWT, jwtVerify } from "jose";
import type { AuthProvider } from "@prisma/client";
import type { AppUserRole } from "@/lib/roles";

export type SessionUser = {
  id: string;
  email: string;
  role: AppUserRole;
  employeeId: number | null;
  employeeName: string | null;
  sessionVersion: number;
  authProvider: AuthProvider;
};

export type SessionTokenPayload = SessionUser;

const COOKIE_NAME = "zebl_session";

export { COOKIE_NAME };

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    employeeName: user.employeeName,
    sessionVersion: user.sessionVersion,
    authProvider: user.authProvider,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = payload.role as string;
    const authProvider = payload.authProvider as AuthProvider;

    if (!role || !authProvider) return null;

    return {
      id: payload.id as string,
      email: payload.email as string,
      role: role as AppUserRole,
      employeeId: (payload.employeeId as number | null) ?? null,
      employeeName: (payload.employeeName as string | null) ?? null,
      sessionVersion: (payload.sessionVersion as number) ?? 1,
      authProvider,
    };
  } catch {
    return null;
  }
}
