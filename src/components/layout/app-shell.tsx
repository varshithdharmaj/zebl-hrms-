"use client";

import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopBar, AppTopBarDesktop } from "@/components/layout/app-top-bar";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { hasDirectReportsNavAction } from "@/actions/employee-nav";

export function AppShell({
  user,
  children,
  variant = "default",
  showApprovals = false,
  /**
   * Employee shell: resolve Team Approvals nav after first paint so the layout
   * does not block on a direct-reports COUNT (presentation-only).
   */
  deferApprovalsNav = false,
}: {
  user: SessionUser;
  children: React.ReactNode;
  variant?: "default" | "wide";
  showApprovals?: boolean;
  deferApprovalsNav?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [approvalsVisible, setApprovalsVisible] = useState(
    deferApprovalsNav ? false : showApprovals
  );
  const displayName = user.employeeName ?? user.email;

  useEffect(() => {
    if (!deferApprovalsNav) {
      setApprovalsVisible(showApprovals);
      return;
    }
    let cancelled = false;
    void hasDirectReportsNavAction()
      .then((visible) => {
        if (!cancelled) setApprovalsVisible(visible);
      })
      .catch(() => {
        if (!cancelled) setApprovalsVisible(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deferApprovalsNav, showApprovals]);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        role={user.role}
        userName={displayName}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        showApprovals={approvalsVisible}
      />
      <div
        className={cn(
          "transition-[padding] duration-300 ease-in-out",
          collapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        <AppTopBar />
        <main
          className={
            variant === "wide"
              ? "min-h-screen w-full px-4 py-6 pt-[4.5rem] sm:px-6 lg:px-8 lg:py-8 lg:pt-8 xl:px-10"
              : "mx-auto min-h-screen w-full max-w-[var(--page-max)] px-5 py-8 pt-16 lg:px-10 lg:pt-10"
          }
        >
          <AppTopBarDesktop />
          {children}
        </main>
      </div>
    </div>
  );
}
