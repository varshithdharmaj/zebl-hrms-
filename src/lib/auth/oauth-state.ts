import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "zebl_oauth_pending";
const MAX_AGE_SEC = 600;

export type OAuthPendingPayload = {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
};

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signOAuthPending(payload: OAuthPendingPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret());
}

export async function verifyOAuthPending(token: string): Promise<OAuthPendingPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const state = payload.state as string;
    const nonce = payload.nonce as string;
    const codeVerifier = payload.codeVerifier as string;
    const returnTo = payload.returnTo as string;
    if (!state || !nonce || !codeVerifier || !returnTo) return null;
    return { state, nonce, codeVerifier, returnTo };
  } catch {
    return null;
  }
}

export { COOKIE_NAME as OAUTH_PENDING_COOKIE };

export function oauthPendingCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function clearOAuthPendingCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

/** Prevent open redirects — only same-app relative paths. */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}
