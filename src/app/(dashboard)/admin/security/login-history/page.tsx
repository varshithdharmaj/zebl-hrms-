import { LoginSessionStatus, UserRole } from "@/generated/prisma/enums";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { LoginHistoryExportButtons } from "@/components/security/login-history-export-buttons";
import { LoginHistoryFilters } from "@/components/security/login-history-filters";
import { LoginHistoryTable } from "@/components/security/login-history-table";
import { SectionCard } from "@/components/ui/section-card";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { isSuperAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getLoginHistory,
  type LoginHistoryFilters as ServiceFilters,
} from "@/lib/security/login-history-service";

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

export default async function AdminLoginHistoryPage({
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
    status: enumValue(Object.values(LoginSessionStatus), params.status),
    from: dateValue(params.from),
    to: dateValue(params.to, true),
    role: enumValue(Object.values(UserRole), params.role),
    department: params.department,
    browser: params.browser,
    employeeId: params.employeeId ? Number(params.employeeId) || undefined : undefined,
    page: Math.max(1, Number(params.page) || 1),
  };

  const [result, departments] = await Promise.all([
    getLoginHistory(filters, { includeFailed: allowSensitiveActions }),
    prisma.employee.findMany({
      where: { department: { not: null } },
      distinct: ["department"],
      select: { department: true },
      orderBy: { department: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Login History"
        description="Monitor account access across employees and administrators."
        action={
          <LoginHistoryExportButtons
            filters={filters}
            allowExcel={allowSensitiveActions}
          />
        }
      />
      <SectionCard title="Search & filters" description={`${result.total} login records`}>
        <LoginHistoryFilters
          filters={params}
          basePath="/admin/security/login-history"
          admin
          departments={departments.flatMap((row) => row.department ? [row.department] : [])}
        />
      </SectionCard>
      <SectionCard title="Security activity" noPadding>
        <div className="p-4 sm:p-5">
          <LoginHistoryTable
            rows={result.rows}
            total={result.total}
            page={result.page}
            pageSize={result.pageSize}
            filters={params}
            basePath="/admin/security/login-history"
            showIdentity
          />
        </div>
      </SectionCard>
    </div>
  );
}
