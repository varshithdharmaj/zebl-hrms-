import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import { getRoleHomePath } from "@/lib/routing";
import { canAccessAdmin, canAccessEmployeeShell, canAccessHRAdministration } from "@/lib/permissions";
import {
  isAdminRecruitmentPath,
  isRecruitmentTestManager,
} from "@/lib/recruitment/permissions/recruitment-test-manager";
import { isSessionVersionStale } from "@/lib/session-version-cache";
import type { AppUserRole } from "@/lib/roles";
import {
  isApplyPublicPath,
  isApprovalPublicPath,
  isCronPublicPath,
  isOwnWorkspaceSelfServicePath,
  isPublicPath,
} from "@/lib/public-routes";
import {
  isPasswordChangeAllowedPath,
  sessionRequiresPasswordChange,
} from "@/lib/auth/password-change-gate";

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
    response.cookies.set(COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
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
    if (session) {
      if (sessionRequiresPasswordChange(session)) {
        return NextResponse.redirect(new URL("/change-password", request.url));
      }
      return redirectToRoleHome(request, session.role);
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && request.nextUrl.searchParams.get("clear") === "1") {
      const response = NextResponse.next();
      response.cookies.set(COOKIE_NAME, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      return response;
    }
    // Cron process routes authenticate via Bearer secret; the public career
    // portal is anonymous by design — neither should ever bounce to role home.
    if (
      session &&
      !isApprovalPublicPath(pathname) &&
      !isCronPublicPath(pathname) &&
      !isApplyPublicPath(pathname)
    ) {
      if (sessionRequiresPasswordChange(session)) {
        if (!isPasswordChangeAllowedPath(pathname)) {
          return NextResponse.redirect(new URL("/change-password", request.url));
        }
        return NextResponse.next();
      }
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

  if (sessionRequiresPasswordChange(session) && !isPasswordChangeAllowedPath(pathname)) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (pathname.startsWith("/admin") && !canAccessAdmin(session.role)) {
    const recruitmentException =
      isAdminRecruitmentPath(pathname) && isRecruitmentTestManager(session);
    if (!recruitmentException) {
      return redirectToRoleHome(request, session.role);
    }
  }

  if (pathname.startsWith("/employee") && !canAccessEmployeeShell(session.role)) {
    // Carve-out: HR/Super Admin may view their OWN self-service pages
    // (dashboard/attendance/leaves/profile) when linked to an Employee
    // record — everything else under /employee (My Team, tickets,
    // approvals) stays Employee/Manager-only.
    const isAdminSelfService =
      canAccessHRAdministration(session.role) &&
      session.employeeId != null &&
      isOwnWorkspaceSelfServicePath(pathname);
    if (!isAdminSelfService) {
      return redirectToRoleHome(request, session.role);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
