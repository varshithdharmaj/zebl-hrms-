import { MonitorSmartphone, ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import type { SecuritySummary } from "@/lib/security/login-history-service";
import { formatDate } from "@/lib/utils";

function OverviewStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/80 bg-muted/30 px-4 py-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-subtle">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export function SecurityOverview({
  summary,
  showFailedLogin = false,
}: {
  summary: SecuritySummary;
  showFailedLogin?: boolean;
}) {
  const device = summary.currentDevice;
  const deviceLabel = device
    ? [device.browser, device.operatingSystem].filter(Boolean).join(" · ") || "This device"
    : "Unknown";

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      role="list"
      aria-label="Security overview"
    >
      <div role="listitem">
        <OverviewStat
          icon={MonitorSmartphone}
          label="Current device"
          value={deviceLabel}
          hint={device?.ipAddress ? `IP ${device.ipAddress}` : undefined}
        />
      </div>
      <div role="listitem">
        <OverviewStat
          icon={ShieldCheck}
          label="Active sessions"
          value={String(summary.activeSessionCount)}
          hint={
            summary.activeSessionCount === 1
              ? "1 device signed in"
              : `${summary.activeSessionCount} devices signed in`
          }
        />
      </div>
      <div role="listitem">
        <OverviewStat
          icon={Clock}
          label="Last successful login"
          value={summary.lastLogin ? formatDate(summary.lastLogin.loginAt) : "—"}
          hint={
            summary.lastLogin
              ? [summary.lastLogin.browser, summary.lastLogin.device].filter(Boolean).join(" · ")
              : undefined
          }
        />
      </div>
      {showFailedLogin && (
        <div role="listitem">
          <OverviewStat
            icon={ShieldAlert}
            label="Last failed login"
            value={
              summary.lastFailedLogin
                ? formatDate(summary.lastFailedLogin.loginAt)
                : "None recorded"
            }
            hint={
              summary.lastFailedLogin?.failureReason?.replaceAll("_", " ") ??
              summary.lastFailedLogin?.attemptedEmail ??
              undefined
            }
          />
        </div>
      )}
    </div>
  );
}
