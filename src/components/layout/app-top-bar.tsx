"use client";

import { useEffect, useState } from "react";
import { GlobalCommandPalette } from "@/components/search/global-command-palette";
import { NotificationCenterButton } from "@/components/layout/notification-center";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mql.matches);

    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function AppTopBar() {
  const isMobile = useIsMobile();

  return (
    <div className="sticky top-0 z-30 flex items-center justify-end gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
      <GlobalCommandPalette />
      {isMobile === true && <NotificationCenterButton />}
    </div>
  );
}

export function AppTopBarDesktop() {
  const isMobile = useIsMobile();

  return (
    <div className="mb-6 hidden items-center justify-between gap-4 lg:flex">
      <GlobalCommandPalette />
      {isMobile === false && <NotificationCenterButton />}
    </div>
  );
}
