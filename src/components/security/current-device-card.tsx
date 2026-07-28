import { Globe, MapPin, Monitor } from "lucide-react";
import { browserIconLabel } from "@/components/security/session-device-meta";
import type { LoginSessionListRow } from "@/lib/security/login-history-service";
import { formatDate } from "@/lib/utils";

export function CurrentDeviceCard({
  device,
}: {
  device: LoginSessionListRow | null;
}) {
  if (!device) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not identify this device session. Sign out and sign back in if this persists.
      </p>
    );
  }

  const browser = browserIconLabel(device.browser, device.browserVersion);
  const os = device.operatingSystem ?? "Unknown OS";
  const ip = device.ipAddress ?? "Unknown";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          This Device
        </span>
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="font-medium">{browser}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Monitor className="h-3.5 w-3.5" aria-hidden />
          {os}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {ip}
        </span>
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">
        Last active {formatDate(device.lastActivityAt)}
      </p>
    </div>
  );
}
