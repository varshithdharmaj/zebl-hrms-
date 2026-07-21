import { LoginSessionStatus } from "@prisma/client";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { LoginHistoryFilters } from "@/components/security/login-history-filters";
import { LoginHistoryTable } from "@/components/security/login-history-table";
import { SectionCard } from "@/components/ui/section-card";
import { requireEmployeeSession } from "@/lib/auth-guards";
import { getLoginHistory } from "@/lib/security/login-history-service";

function statusValue(value?: string): LoginSessionStatus | undefined {
  return Object.values(LoginSessionStatus).includes(value as LoginSessionStatus)
    ? (value as LoginSessionStatus)
    : undefined;
}

function dateValue(value?: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function EmployeeLoginHistoryPage({
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
  const result = await getLoginHistory(
    {
      search: params.q,
      status: statusValue(params.status),
      from: dateValue(params.from),
      to: dateValue(params.to, true),
      page,
    },
    { employeeId: session.employeeId }
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="My Login History"
        description="Review devices and sessions that accessed your account."
      />
      <SectionCard title="Search & filters" description={`${result.total} login records`}>
        <LoginHistoryFilters
          filters={params}
          basePath="/employee/security/login-history"
        />
      </SectionCard>
      <SectionCard title="Login history" noPadding>
        <div className="p-4 sm:p-5">
          <LoginHistoryTable
            rows={result.rows}
            total={result.total}
            page={result.page}
            pageSize={result.pageSize}
            filters={params}
            basePath="/employee/security/login-history"
          />
        </div>
      </SectionCard>
    </div>
  );
}
