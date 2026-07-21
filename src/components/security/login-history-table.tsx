import Link from "next/link";
import type { LoginSessionStatus, UserRole } from "@prisma/client";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";

export type LoginHistoryRow = {
  id: string;
  attemptedEmail: string | null;
  loginAt: Date;
  logoutAt: Date | null;
  lastActivityAt: Date;
  status: LoginSessionStatus;
  ipAddress: string | null;
  browser: string | null;
  browserVersion: string | null;
  device: string | null;
  operatingSystem: string | null;
  sessionDuration: number | null;
  failureReason: string | null;
  isCurrent: boolean;
  user: { id: string; email: string; role: UserRole } | null;
  employee: {
    id: number;
    name: string;
    employeeCode: string;
    department: string | null;
  } | null;
};

function durationLabel(seconds: number | null): string {
  if (seconds == null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function queryString(
  filters: Record<string, string | undefined>,
  page: number
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  params.set("page", String(page));
  return params.toString();
}

export function LoginHistoryTable({
  rows,
  total,
  page,
  pageSize,
  filters,
  basePath,
  showIdentity = false,
}: {
  rows: LoginHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: Record<string, string | undefined>;
  basePath: string;
  showIdentity?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columns = showIdentity
    ? ["Employee", "Role", "Department", "Login", "Logout", "Duration", "Browser", "Device", "OS", "IP", "Status", "Details"]
    : ["Date & time", "Status", "Browser", "Device", "OS", "IP address", "Logout time", "Duration"];

  return (
    <div className="space-y-4">
      <DataTable columns={columns} emptyMessage="No login history matches these filters.">
        {rows.map((row) => (
          <DataTableRow key={row.id}>
            {showIdentity && (
              <>
                <DataTableCell>
                  <p className="font-medium">{row.employee?.name ?? row.attemptedEmail ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.employee?.employeeCode ?? row.user?.email ?? "Failed attempt"}
                  </p>
                </DataTableCell>
                <DataTableCell className="capitalize">{row.user?.role.replace("_", " ") ?? "—"}</DataTableCell>
                <DataTableCell>{row.employee?.department ?? "—"}</DataTableCell>
              </>
            )}
            <DataTableCell className="whitespace-nowrap">{formatDate(row.loginAt)}</DataTableCell>
            {!showIdentity && (
              <DataTableCell>
                <StatusBadge status={row.status.replace("_", " ")} />
              </DataTableCell>
            )}
            {showIdentity && (
              <>
                <DataTableCell className="whitespace-nowrap">{row.logoutAt ? formatDate(row.logoutAt) : "—"}</DataTableCell>
                <DataTableCell>{durationLabel(row.sessionDuration)}</DataTableCell>
              </>
            )}
            <DataTableCell>
              {row.browser ?? "Unknown"}
              {row.browserVersion && row.browserVersion !== "Unknown" ? ` ${row.browserVersion}` : ""}
            </DataTableCell>
            <DataTableCell>{row.device ?? "Unknown"}</DataTableCell>
            <DataTableCell>{row.operatingSystem ?? "Unknown"}</DataTableCell>
            <DataTableCell className="font-mono text-xs">{row.ipAddress ?? "unknown"}</DataTableCell>
            {!showIdentity && (
              <>
                <DataTableCell className="whitespace-nowrap">{row.logoutAt ? formatDate(row.logoutAt) : "—"}</DataTableCell>
                <DataTableCell>{durationLabel(row.sessionDuration)}</DataTableCell>
              </>
            )}
            {showIdentity && (
              <>
                <DataTableCell>
                  <StatusBadge status={row.status.replace("_", " ")} />
                </DataTableCell>
                <DataTableCell className="text-xs text-muted-foreground">
                  {row.failureReason?.replaceAll("_", " ") ?? "—"}
                </DataTableCell>
              </>
            )}
          </DataTableRow>
        ))}
      </DataTable>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 text-sm">
          <p className="text-muted-foreground">
            Page {page} of {totalPages} · {total} records
          </p>
          <div className="flex gap-3">
            {page > 1 && (
              <Link href={`${basePath}?${queryString(filters, page - 1)}`} className="text-primary hover:underline">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={`${basePath}?${queryString(filters, page + 1)}`} className="text-primary hover:underline">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
