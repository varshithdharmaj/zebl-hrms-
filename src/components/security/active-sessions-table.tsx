import { ActiveSessionsList } from "@/components/security/active-sessions-list";
import type { LoginHistoryRow } from "@/components/security/login-history-table";

/** @deprecated Prefer ActiveSessionsList — kept for compatibility. */
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
  return (
    <ActiveSessionsList
      rows={rows}
      currentSessionId={currentSessionId}
      mode={mode}
      canForceLogout={canForceLogout}
    />
  );
}
