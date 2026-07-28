import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BrowserGlyph,
  browserIconLabel,
} from "@/components/security/session-device-meta";
import {
  LogoutAllSessionsButton,
  SessionRevokeButton,
} from "@/components/security/session-revoke-button";
import type { LoginSessionListRow } from "@/lib/security/login-history-service";
import { formatDate } from "@/lib/utils";

export function ActiveSessionsList({
  rows,
  currentSessionId,
  mode,
  canForceLogout = false,
}: {
  rows: LoginSessionListRow[];
  currentSessionId?: string;
  mode: "employee" | "admin";
  canForceLogout?: boolean;
}) {
  const showIdentity = mode === "admin";
  const otherSessions = rows.filter((row) => row.id !== currentSessionId);
  const canRevoke = mode === "employee" || canForceLogout;

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No active sessions"
        description="There are no devices currently signed in."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-3" aria-label="Active sessions">
        {rows.map((row) => {
          const isCurrent = row.id === currentSessionId;
          return (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-subtle">
                  <BrowserGlyph browser={row.browser} device={row.device} className="h-5 w-5" />
                </span>
                <div className="min-w-0 space-y-1">
                  {showIdentity && (
                    <p className="truncate text-sm font-semibold text-foreground">
                      {row.employee?.name ?? row.user?.email ?? "Unknown user"}
                      <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">
                        {row.user?.role?.replace("_", " ") ?? ""}
                      </span>
                    </p>
                  )}
                  <p className="truncate text-sm font-medium text-foreground">
                    {browserIconLabel(row.browser, row.browserVersion)}
                    <span className="text-muted-foreground">
                      {" · "}
                      {row.operatingSystem ?? "Unknown OS"}
                    </span>
                  </p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {row.ipAddress ?? "Unknown location"}
                    </span>
                    <span>Last seen {formatDate(row.lastActivityAt)}</span>
                  </p>
                  <div className="pt-0.5">
                    {isCurrent ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Current Device
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Active</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="shrink-0 sm:self-center">
                {canRevoke ? (
                  <SessionRevokeButton
                    sessionId={row.id}
                    mode={mode}
                    isCurrent={isCurrent}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">View only</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {mode === "employee" && otherSessions.length === 0 && rows.length === 1 && (
        <p className="text-sm text-muted-foreground">
          No other devices are signed in to your account.
        </p>
      )}

      {mode === "employee" && rows.length > 1 && <LogoutAllSessionsButton />}
    </div>
  );
}
