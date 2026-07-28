import { SecurityHub } from "@/components/security/security-hub";
import { requireEmployeeSession } from "@/lib/auth-guards";
import {
  expireStaleSessions,
  getSecuritySummary,
  getSessions,
  resolveSessionStatusFilter,
} from "@/lib/security/login-history-service";

/** Employees usually review a short personal history; keep the first paint light. */
const EMPLOYEE_SESSIONS_PAGE_SIZE = 10;

function dateValue(value?: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function EmployeeSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const session = await requireEmployeeSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const scope = { employeeId: session.employeeId };

  await expireStaleSessions();

  const [sessions, securitySummary] = await Promise.all([
    getSessions(
      {
        search: params.q,
        status: resolveSessionStatusFilter(params.status),
        from: dateValue(params.from),
        to: dateValue(params.to, true),
        page,
        pageSize: EMPLOYEE_SESSIONS_PAGE_SIZE,
      },
      scope,
      { currentSessionId: session.sessionId, canRevoke: true }
    ),
    getSecuritySummary({
      ...scope,
      currentSessionId: session.sessionId,
    }),
  ]);

  return (
    <SecurityHub
      mode="employee"
      title="Security & Sessions"
      description="Review devices signed into your account and revoke sessions you do not recognize."
      summary={securitySummary}
      sessions={sessions}
      filterParams={params}
    />
  );
}
