import {
  LoginSessionStatus,
  Prisma,
  type UserRole,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { RequestSecurityContext } from "@/lib/security/request-context";

const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

export type LoginHistoryFilters = {
  search?: string;
  status?: LoginSessionStatus;
  from?: Date;
  to?: Date;
  employeeId?: number;
  department?: string;
  role?: UserRole;
  browser?: string;
  page?: number;
  pageSize?: number;
};

export type SuccessfulLoginInput = {
  sessionId: string;
  userId: string;
  employeeId: number | null;
  context: RequestSecurityContext;
};

export type FailedLoginInput = {
  attemptedEmail: string;
  reason: string;
  context: RequestSecurityContext;
};

function durationSeconds(loginAt: Date, logoutAt: Date): number {
  return Math.max(0, Math.floor((logoutAt.getTime() - loginAt.getTime()) / 1000));
}

export async function recordSuccessfulLogin(input: SuccessfulLoginInput): Promise<void> {
  const now = new Date();
  await prisma.loginSession.create({
    data: {
      id: input.sessionId,
      userId: input.userId,
      employeeId: input.employeeId,
      attemptedEmail: null,
      loginAt: now,
      lastActivityAt: now,
      status: LoginSessionStatus.active,
      sessionToken: input.sessionId,
      isCurrent: true,
      ...input.context,
    },
  });
}

export async function recordFailedLogin(input: FailedLoginInput): Promise<void> {
  await prisma.loginSession.create({
    data: {
      attemptedEmail: input.attemptedEmail.toLowerCase(),
      loginAt: new Date(),
      lastActivityAt: new Date(),
      status: LoginSessionStatus.failed,
      failureReason: input.reason,
      isCurrent: false,
      ...input.context,
    },
  });
}

export async function findActiveCurrentLoginSession(
  sessionId: string,
  userId: string
): Promise<{ lastActivityAt: Date } | null> {
  return prisma.loginSession.findFirst({
    where: {
      id: sessionId,
      userId,
      status: LoginSessionStatus.active,
      isCurrent: true,
    },
    select: { lastActivityAt: true },
  });
}

/**
 * Persist last-activity when the throttle window has elapsed.
 * Call only after the login session has already been validated.
 */
export async function touchLoginSessionActivityIfStale(
  sessionId: string,
  userId: string,
  lastActivityAt: Date
): Promise<void> {
  if (Date.now() - lastActivityAt.getTime() < ACTIVITY_WRITE_INTERVAL_MS) {
    return;
  }

  await prisma.loginSession.updateMany({
    where: {
      id: sessionId,
      userId,
      status: LoginSessionStatus.active,
      lastActivityAt,
    },
    data: { lastActivityAt: new Date() },
  });
}

export async function validateAndTouchSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const session = await findActiveCurrentLoginSession(sessionId, userId);
  if (!session) return false;

  await touchLoginSessionActivityIfStale(sessionId, userId, session.lastActivityAt);
  return true;
}

export async function closeSession(
  sessionId: string,
  status: Exclude<LoginSessionStatus, "active" | "failed"> = LoginSessionStatus.logged_out
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.loginSession.findUnique({
      where: { id: sessionId },
      select: { loginAt: true, status: true },
    });
    if (!session || session.status !== LoginSessionStatus.active) return false;

    const logoutAt = new Date();
    await tx.loginSession.update({
      where: { id: sessionId },
      data: {
        status,
        logoutAt,
        lastActivityAt: logoutAt,
        sessionDuration: durationSeconds(session.loginAt, logoutAt),
        isCurrent: false,
      },
    });
    return true;
  });
}

export async function closeAllUserSessions(
  userId: string,
  status: Exclude<LoginSessionStatus, "active" | "failed"> = LoginSessionStatus.revoked
): Promise<number> {
  const now = new Date();
  const active = await prisma.loginSession.findMany({
    where: { userId, status: LoginSessionStatus.active },
    select: { id: true, loginAt: true },
  });

  await prisma.$transaction(
    active.map((session) =>
      prisma.loginSession.update({
        where: { id: session.id },
        data: {
          status,
          logoutAt: now,
          lastActivityAt: now,
          sessionDuration: durationSeconds(session.loginAt, now),
          isCurrent: false,
        },
      })
    )
  );
  return active.length;
}

export async function expireStaleSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);
  const stale = await prisma.loginSession.findMany({
    where: {
      status: LoginSessionStatus.active,
      lastActivityAt: { lt: cutoff },
    },
    select: { id: true },
    take: 1_000,
  });
  for (const session of stale) {
    await closeSession(session.id, LoginSessionStatus.expired);
  }
  return stale.length;
}

function buildWhere(
  filters: LoginHistoryFilters,
  scope?: { employeeId?: number; includeFailed?: boolean; activeOnly?: boolean }
): Prisma.LoginSessionWhereInput {
  const search = filters.search?.trim();
  const includeFailed = scope?.includeFailed === true;

  // Status scoping is authorization-sensitive: when includeFailed is false, failed
  // records must never be returned — even if filters.status explicitly asks for them.
  let statusClause: Prisma.LoginSessionWhereInput;
  if (scope?.activeOnly) {
    statusClause = { status: LoginSessionStatus.active, isCurrent: true };
  } else if (!includeFailed) {
    if (filters.status === LoginSessionStatus.failed) {
      // Deny elevation via query params / direct service calls.
      statusClause = { id: "__failed_login_access_denied__" };
    } else if (filters.status) {
      statusClause = { status: filters.status };
    } else {
      statusClause = { status: { not: LoginSessionStatus.failed } };
    }
  } else if (filters.status) {
    statusClause = { status: filters.status };
  } else {
    statusClause = {};
  }

  return {
    ...(scope?.employeeId ? { employeeId: scope.employeeId } : {}),
    ...statusClause,
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    ...(filters.role ? { user: { role: filters.role } } : {}),
    ...(filters.department
      ? { employee: { department: { equals: filters.department, mode: "insensitive" } } }
      : {}),
    ...(filters.browser
      ? { browser: { contains: filters.browser, mode: "insensitive" } }
      : {}),
    ...(filters.from || filters.to
      ? {
          loginAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { attemptedEmail: { contains: search, mode: "insensitive" } },
            { ipAddress: { contains: search, mode: "insensitive" } },
            { browser: { contains: search, mode: "insensitive" } },
            { employee: { name: { contains: search, mode: "insensitive" } } },
            { employee: { employeeCode: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function getLoginHistory(
  filters: LoginHistoryFilters,
  scope?: { employeeId?: number; includeFailed?: boolean; activeOnly?: boolean }
) {
  if (scope?.activeOnly) {
    await expireStaleSessions();
  }
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const where = buildWhere(filters, scope);

  const [total, rows] = await Promise.all([
    prisma.loginSession.count({ where }),
    prisma.loginSession.findMany({
      where,
      orderBy: { loginAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        attemptedEmail: true,
        loginAt: true,
        logoutAt: true,
        lastActivityAt: true,
        status: true,
        ipAddress: true,
        browser: true,
        browserVersion: true,
        device: true,
        operatingSystem: true,
        sessionDuration: true,
        failureReason: true,
        isCurrent: true,
        user: { select: { id: true, email: true, role: true } },
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            department: true,
          },
        },
      },
    }),
  ]);

  return { rows, total, page, pageSize };
}

export async function getLoginHistoryExportRows(
  filters: LoginHistoryFilters,
  includeFailed: boolean
) {
  return prisma.loginSession.findMany({
    where: buildWhere(filters, { includeFailed }),
    orderBy: { loginAt: "desc" },
    take: 10_000,
    select: {
      attemptedEmail: true,
      loginAt: true,
      logoutAt: true,
      sessionDuration: true,
      failureReason: true,
      status: true,
      ipAddress: true,
      browser: true,
      browserVersion: true,
      device: true,
      operatingSystem: true,
      user: { select: { email: true, role: true } },
      employee: {
        select: { name: true, employeeCode: true, department: true },
      },
    },
  });
}

export const LoginHistoryService = {
  recordSuccessfulLogin,
  recordFailedLogin,
  findActiveCurrentLoginSession,
  touchLoginSessionActivityIfStale,
  validateAndTouchSession,
  closeSession,
  closeAllUserSessions,
  expireStaleSessions,
  getLoginHistory,
  getLoginHistoryExportRows,
};
