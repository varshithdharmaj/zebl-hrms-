import { CurrentDeviceCard } from "@/components/security/current-device-card";
import { LoginHistoryFilters } from "@/components/security/login-history-filters";
import { SessionsTable } from "@/components/security/sessions-table";
import { SectionCard } from "@/components/ui/section-card";
import type {
  SecuritySummary,
  SessionView,
} from "@/lib/security/login-history-service";

export type SecurityHubSessions = {
  rows: SessionView[];
  total: number;
  page: number;
  pageSize: number;
};

export function SecurityHub({
  mode,
  title,
  description,
  headerAction,
  summary,
  sessions,
  filterParams,
  departments = [],
  allowFailedStatus = false,
}: {
  mode: "employee" | "admin";
  title: string;
  description: string;
  headerAction?: React.ReactNode;
  summary: SecuritySummary;
  sessions: SecurityHubSessions;
  filterParams: Record<string, string | undefined>;
  departments?: string[];
  allowFailedStatus?: boolean;
}) {
  const basePath = mode === "admin" ? "/admin/security" : "/employee/security";

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </header>

      <SectionCard title="Current Device" contentClassName="p-4 sm:px-5 sm:py-4">
        <CurrentDeviceCard device={summary.currentDevice} />
      </SectionCard>

      <SectionCard
        title="Sessions"
        description={`${sessions.total} session${sessions.total === 1 ? "" : "s"}`}
        noPadding
      >
        <div className="space-y-4 p-4 sm:p-5">
          <LoginHistoryFilters
            filters={filterParams}
            basePath={basePath}
            admin={mode === "admin"}
            allowFailedStatus={allowFailedStatus}
            departments={departments}
          />
          <SessionsTable
            rows={sessions.rows}
            total={sessions.total}
            page={sessions.page}
            pageSize={sessions.pageSize}
            filters={filterParams}
            basePath={basePath}
            mode={mode}
            showLogoutAll={mode === "employee" && summary.activeSessionCount > 1}
          />
        </div>
      </SectionCard>
    </div>
  );
}
