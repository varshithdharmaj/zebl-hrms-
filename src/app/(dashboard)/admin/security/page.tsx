import { UserRole } from "@/generated/prisma/enums";
import { LoginHistoryExportButtons } from "@/components/security/login-history-export-buttons";
import { SecurityHub } from "@/components/security/security-hub";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { isSuperAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  expireStaleSessions,
  getSecuritySummary,
  getSessions,
  resolveSessionStatusFilter,
  type LoginHistoryFilters as ServiceFilters,
} from "@/lib/security/login-history-service";

/** Admins scan across users; slightly denser first page before paging. */
const ADMIN_SESSIONS_PAGE_SIZE = 20;

function enumValue<T extends string>(
  values: readonly T[],
  value?: string
): T | undefined {
  return values.includes(value as T) ? (value as T) : undefined;
}

function dateValue(value?: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    role?: string;
    department?: string;
    browser?: string;
    employeeId?: string;
    page?: string;
  }>;
}) {
  const session = await requireHROrSuperAdminSession();
  const params = await searchParams;
  const allowSensitiveActions = isSuperAdmin(session.role);
  const filters: ServiceFilters = {
    search: params.q,
    status: resolveSessionStatusFilter(params.status),
    from: dateValue(params.from),
    to: dateValue(params.to, true),
    role: enumValue(Object.values(UserRole), params.role),
    department: params.department,
    browser: params.browser,
    employeeId: params.employeeId ? Number(params.employeeId) || undefined : undefined,
    page: Math.max(1, Number(params.page) || 1),
    pageSize: ADMIN_SESSIONS_PAGE_SIZE,
  };

  await expireStaleSessions();

  const [sessions, securitySummary, departments] = await Promise.all([
    getSessions(
      filters,
      { includeFailed: allowSensitiveActions },
      {
        currentSessionId: session.sessionId,
        canRevoke: allowSensitiveActions,
      }
    ),
    getSecuritySummary({
      includeFailed: allowSensitiveActions,
      currentSessionId: session.sessionId,
    }),
    prisma.employee.findMany({
      where: { department: { not: null } },
      distinct: ["department"],
      select: { department: true },
      orderBy: { department: "asc" },
    }),
  ]);

  return (
    <SecurityHub
      mode="admin"
      title="Security & Sessions"
      description="Find sessions across HRMS and revoke active access when needed."
      headerAction={
        <LoginHistoryExportButtons
          filters={filters}
          allowExcel={allowSensitiveActions}
        />
      }
      summary={securitySummary}
      sessions={sessions}
      filterParams={params}
      departments={departments.flatMap((row) => (row.department ? [row.department] : []))}
      allowFailedStatus={allowSensitiveActions}
    />
  );
}
