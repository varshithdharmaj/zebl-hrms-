import Link from "next/link";
import { MapPin } from "lucide-react";
import {
  BrowserGlyph,
  browserIconLabel,
} from "@/components/security/session-device-meta";
import {
  LogoutAllSessionsButton,
  SessionRevokeButton,
} from "@/components/security/session-revoke-button";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SESSION_VIEW_STATUS_LABEL,
  type SessionView,
} from "@/lib/security/login-history-service";
import { formatDate } from "@/lib/utils";

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

export function SessionsTable({
  rows,
  total,
  page,
  pageSize,
  filters,
  basePath,
  mode,
  showLogoutAll = false,
}: {
  rows: SessionView[];
  total: number;
  page: number;
  pageSize: number;
  filters: Record<string, string | undefined>;
  basePath: string;
  mode: "employee" | "admin";
  /** Employee-only: revoke every device including this one. */
  showLogoutAll?: boolean;
}) {
  const showIdentity = mode === "admin";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columns = [
    ...(showIdentity ? ["Employee"] : []),
    "Device",
    "Browser",
    "OS",
    "Location / IP",
    "Started",
    "Last activity",
    "Status",
    "Action",
  ];

  return (
    <div className="space-y-4">
      <DataTable columns={columns} emptyMessage="No sessions match these filters.">
        {rows.map((row) => (
          <DataTableRow key={row.id}>
            {showIdentity && (
              <DataTableCell>
                <p className="font-medium">
                  {row.employee?.name ?? row.attemptedEmail ?? row.user?.email ?? "Unknown"}
                </p>
                <p className="text-xs capitalize text-muted-foreground">
                  {row.user?.role?.replace("_", " ") ??
                    row.employee?.employeeCode ??
                    "—"}
                </p>
              </DataTableCell>
            )}
            <DataTableCell>
              <span className="inline-flex items-center gap-2">
                <BrowserGlyph browser={row.browser} device={row.device} />
                {row.device ?? "Unknown"}
              </span>
            </DataTableCell>
            <DataTableCell>{browserIconLabel(row.browser, row.browserVersion)}</DataTableCell>
            <DataTableCell>{row.os ?? "Unknown"}</DataTableCell>
            <DataTableCell>
              <span className="inline-flex items-center gap-1 font-mono text-xs">
                <MapPin className="h-3 w-3 text-muted-foreground" aria-hidden />
                {row.ip ?? "unknown"}
              </span>
            </DataTableCell>
            <DataTableCell className="whitespace-nowrap">{formatDate(row.startedAt)}</DataTableCell>
            <DataTableCell className="whitespace-nowrap">
              {formatDate(row.lastActivityAt)}
            </DataTableCell>
            <DataTableCell>
              <StatusBadge status={SESSION_VIEW_STATUS_LABEL[row.status]} />
              {row.failureReason && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.failureReason.replaceAll("_", " ")}
                </p>
              )}
            </DataTableCell>
            <DataTableCell>
              {row.canRevoke ? (
                <SessionRevokeButton
                  sessionId={row.id}
                  mode={mode}
                  isCurrent={row.isCurrent}
                />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 text-sm">
          <p className="text-muted-foreground">
            Page {page} of {totalPages} · {total} sessions
          </p>
          <div className="flex gap-3">
            {page > 1 && (
              <Link
                href={`${basePath}?${queryString(filters, page - 1)}`}
                className="text-primary hover:underline"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`${basePath}?${queryString(filters, page + 1)}`}
                className="text-primary hover:underline"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}

      {mode === "employee" && showLogoutAll && <LogoutAllSessionsButton />}
    </div>
  );
}
