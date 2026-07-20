import { GlobalCommandPalette } from "@/components/search/global-command-palette";
import { NotificationCenterButton } from "@/components/layout/notification-center";

export function AppTopBar() {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-end gap-2 border-b border-border bg-background px-4 py-2 lg:hidden">
      <GlobalCommandPalette />
      <NotificationCenterButton />
    </div>
  );
}

export function AppTopBarDesktop() {
  return (
    <div className="mb-6 hidden items-center justify-between gap-4 border-b border-border/80 pb-4 lg:flex">
      <GlobalCommandPalette />
      <div className="flex items-center gap-3">
        <NotificationCenterButton />
      </div>
    </div>
  );
}
