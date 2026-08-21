import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/session";
import { SESSION_MAX_LIFETIME_SECONDS } from "@/lib/auth/session-policy";

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_LIFETIME_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
