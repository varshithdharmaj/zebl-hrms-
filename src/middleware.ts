import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import { getRoleHomePath } from "@/lib/routing";
import { canAccessAdmin, canAccessEmployeeShell } from "@/lib/permissions";
import { isSessionVersionStale } from "@/lib/session-version-cache";
import type { AppUserRole } from "@/lib/roles";
import { isApprovalPublicPath, isPublicPath } from "@/lib/public-routes";

function redirectToRoleHome(request: NextRequest, role: AppUserRole) {
  return NextResponse.redirect(new URL(getRoleHomePath(role), request.url));
}

function redirectToLogin(request: NextRequest, pathname: string, clearSession: boolean) {
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/login") {
    loginUrl.searchParams.set("from", pathname);
  }
  const response = NextResponse.redirect(loginUrl);
  if (clearSession) {
    response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (session) {
    const stale = isSessionVersionStale(session.id, session.sessionVersion);
    if (stale === true && !isApprovalPublicPath(pathname)) {
      return redirectToLogin(request, pathname, true);
    }
  }

  if (pathname === "/") {
    if (session) return redirectToRoleHome(request, session.role);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && request.nextUrl.searchParams.get("clear") === "1") {
      const response = NextResponse.next();
      response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
      return response;
    }
    if (session && !isApprovalPublicPath(pathname)) {
      // Do not bounce away from login when sent here after a failed dashboard auth check.
      const returningFromProtected = request.nextUrl.searchParams.has("from");
      const clearingSession = request.nextUrl.searchParams.get("clear") === "1";
      if (!returningFromProtected && !clearingSession) {
        return redirectToRoleHome(request, session.role);
      }
    }
    return NextResponse.next();
  }

  if (!session) {
    return redirectToLogin(request, pathname, false);
  }

  if (pathname.startsWith("/admin") && !canAccessAdmin(session.role)) {
    return redirectToRoleHome(request, session.role);
  }

  if (pathname.startsWith("/employee") && !canAccessEmployeeShell(session.role)) {
    return redirectToRoleHome(request, session.role);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
