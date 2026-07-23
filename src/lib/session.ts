import { SignJWT, jwtVerify } from "jose";
import type { AuthProvider } from "@/generated/prisma/enums";
import type { AppUserRole } from "@/lib/roles";

export type SessionUser = {
  id: string;
  email: string;
  role: AppUserRole;
  employeeId: number | null;
  employeeName: string | null;
  sessionVersion: number;
  authProvider: AuthProvider;
  sessionId?: string;
  mustChangePassword?: boolean;
};

export type SessionTokenPayload = SessionUser;

const COOKIE_NAME = "zebl_session";

export { COOKIE_NAME };

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser, sessionId?: string): Promise<string> {
  const jwt = new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    employeeName: user.employeeName,
    sessionVersion: user.sessionVersion,
    authProvider: user.authProvider,
    mustChangePassword: user.mustChangePassword ?? false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d");
  if (sessionId) jwt.setJti(sessionId);
  return jwt.sign(getSecret());
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
      sessionId: typeof payload.jti === "string" ? payload.jti : undefined,
      mustChangePassword: payload.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}
