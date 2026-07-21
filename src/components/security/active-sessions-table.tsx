import { MonitorSmartphone } from "lucide-react";
import {
  forceLogoutSessionAction,
  logoutAllOwnSessionsAction,
  logoutSessionAction,
} from "@/actions/security";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import type { LoginHistoryRow } from "@/components/security/login-history-table";

export function ActiveSessionsTable({
  rows,
  currentSessionId,
  mode,
  canForceLogout = false,
}: {
  rows: LoginHistoryRow[];
  currentSessionId?: string;
  mode: "employee" | "admin";
  canForceLogout?: boolean;
}) {
  const showIdentity = mode === "admin";
  const columns = [
    ...(showIdentity ? ["Employee"] : []),
    "Device",
    "Browser",
    "OS",
    "IP",
    "Login time",
    "Last activity",
    "Session",
    "Action",
  ];

  return (
    <div className="space-y-4">
      <DataTable columns={columns} emptyMessage="No active sessions found.">
        {rows.map((row) => {
          const isCurrent = row.id === currentSessionId;
          return (
            <DataTableRow key={row.id}>
              {showIdentity && (
                <DataTableCell>
                  <p className="font-medium">{row.employee?.name ?? row.user?.email ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{row.user?.role ?? "—"}</p>
                </DataTableCell>
              )}
              <DataTableCell>
                <span className="inline-flex items-center gap-2">
                  <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                  {row.device ?? "Unknown"}
                </span>
              </DataTableCell>
              <DataTableCell>{row.browser ?? "Unknown"} {row.browserVersion ?? ""}</DataTableCell>
              <DataTableCell>{row.operatingSystem ?? "Unknown"}</DataTableCell>
              <DataTableCell className="font-mono text-xs">{row.ipAddress ?? "unknown"}</DataTableCell>
              <DataTableCell className="whitespace-nowrap">{formatDate(row.loginAt)}</DataTableCell>
              <DataTableCell className="whitespace-nowrap">{formatDate(row.lastActivityAt)}</DataTableCell>
              <DataTableCell>
                {isCurrent ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                    Current
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Active</span>
                )}
              </DataTableCell>
              <DataTableCell>
                {(mode === "employee" || canForceLogout) ? (
                  <form action={mode === "employee" ? logoutSessionAction : forceLogoutSessionAction}>
                    <input type="hidden" name="sessionId" value={row.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Log out
                    </Button>
                  </form>
                ) : (
                  <span className="text-xs text-muted-foreground">View only</span>
                )}
              </DataTableCell>
            </DataTableRow>
          );
        })}
      </DataTable>

      {mode === "employee" && rows.length > 1 && (
        <form action={logoutAllOwnSessionsAction}>
          <Button type="submit" variant="destructive" size="sm">
            Log out all sessions
          </Button>
        </form>
      )}
    </div>
  );
}
