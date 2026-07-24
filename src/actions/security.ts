"use server";

import { LoginSessionStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSessionCookie, invalidateUserSessionsWithAudit } from "@/lib/auth";
import {
  requireEmployeeSession,
  requireSuperAdminSession,
} from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  closeAllUserSessions,
  closeSession,
} from "@/lib/security/login-history-service";
import { getRequestSecurityContext } from "@/lib/security/request-context";

export async function logoutSessionAction(formData: FormData): Promise<void> {
  const actor = await requireEmployeeSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return;

  const target = await prisma.loginSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!target || target.userId !== actor.id) return;

  await closeSession(sessionId, LoginSessionStatus.revoked);
  await writeAuditLog({
    entityType: "login_session",
    entityId: sessionId,
    action: AUDIT_ACTIONS.AUTH_SESSION_INVALIDATED,
    actorUserId: actor.id,
    actorEmail: actor.email,
    employeeId: actor.employeeId,
    module: "authentication",
    description: "Employee revoked one of their login sessions.",
    requestContext: await getRequestSecurityContext(),
    metadata: { reason: "employee_session_revoked" },
  });

  if (actor.sessionId === sessionId) {
    await clearSessionCookie();
    redirect("/login");
  }
  revalidatePath("/employee/security/active-sessions");
}

export async function logoutAllOwnSessionsAction(): Promise<void> {
  const actor = await requireEmployeeSession();
  await closeAllUserSessions(actor.id, LoginSessionStatus.revoked);
  await invalidateUserSessionsWithAudit(
    actor.id,
    { userId: actor.id, email: actor.email },
    "employee_logout_all"
  );
  await clearSessionCookie();
  redirect("/login");
}

export async function forceLogoutSessionAction(formData: FormData): Promise<void> {
  const actor = await requireSuperAdminSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return;

  const target = await prisma.loginSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, employeeId: true },
  });
  if (!target) return;

  // Single-session revoke: closes this LoginSession only. JWTs carry jti=sessionId;
  // getSession() rejects via validateAndTouchSession. Other devices remain signed in.
  // Do NOT call invalidateUserSessions() here — that would revoke the user's entire fleet.
  await closeSession(sessionId, LoginSessionStatus.revoked);
  await writeAuditLog({
    entityType: "login_session",
    entityId: sessionId,
    action: AUDIT_ACTIONS.AUTH_SESSION_INVALIDATED,
    actorUserId: actor.id,
    actorEmail: actor.email,
    employeeId: target.employeeId,
    module: "authentication",
    description: "Super Admin force-logged out a session.",
    requestContext: await getRequestSecurityContext(),
    metadata: { reason: "super_admin_force_logout", targetUserId: target.userId },
  });

  if (actor.sessionId === sessionId) {
    await clearSessionCookie();
    redirect("/login");
  }
  revalidatePath("/admin/security/active-sessions");
}
