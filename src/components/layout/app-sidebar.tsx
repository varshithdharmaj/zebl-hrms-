"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Users,
  ClipboardList,
  Banknote,
  CalendarDays,
  History,
  Bell,
  Plug,
  BarChart3,
  ScrollText,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/auth";
import type { AppUserRole } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/roles";
import { getRoleHomePath } from "@/lib/routing";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { group: string; items: NavItem[] };

function groupedNavForRole(role: AppUserRole): NavGroup[] {
  switch (role) {
    case "admin":
    case "hr_admin":
      return [
        {
          group: "Core Workforce",
          items: [
            { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/admin/employees", label: "Employees", icon: Users },
            { href: "/admin/attendance", label: "Attendance", icon: ClipboardList },
            { href: "/admin/payroll-attendance", label: "Payroll Attendance", icon: Banknote },
            { href: "/admin/leaves", label: "Leaves", icon: CalendarDays },
            { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
            { href: "/admin/upload", label: "Upload Data", icon: Upload },
          ],
        },
        {
          group: "System Operations",
          items: [
            { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
            { href: "/admin/operations", label: "Operations", icon: Activity },
            { href: "/admin/notifications", label: "Notifications", icon: Bell },
            { href: "/admin/integrations", label: "Integrations", icon: Plug },
            { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
          ],
        },
        {
          group: "Settings",
          items: [
            { href: "/admin/settings", label: "System Settings", icon: Settings },
            { href: "/admin/payroll-settings", label: "Payroll Settings", icon: Settings },
          ],
        },
      ];
    case "manager":
      return [
        {
          group: "Management",
          items: [
            { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/manager/approvals", label: "Approvals", icon: UserCheck },
            { href: "/manager/settings", label: "Settings", icon: Settings },
          ],
        },
      ];
    case "employee":
    default:
      return [
        {
          group: "Workspace",
          items: [
            { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/employee/attendance", label: "History", icon: History },
            { href: "/employee/leaves", label: "Leaves", icon: CalendarDays },
            { href: "/employee/settings", label: "Settings", icon: Settings },
          ],
        },
      ];
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AppSidebar({
  role,
  userName,
  collapsed = false,
  onToggleCollapse,
}: {
  role: AppUserRole;
  userName: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const onMobileOpen = () => setMobileOpen(true);
  const onMobileClose = () => setMobileOpen(false);
  const pathname = usePathname();
  const groups = groupedNavForRole(role);
  const home = getRoleHomePath(role);

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-sidebar-border bg-card text-foreground shadow-subtle lg:hidden"
        onClick={onMobileOpen}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
          onClick={onMobileClose}
          aria-label="Close overlay"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-300 ease-in-out lg:translate-x-0",
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <Link href={home} className="flex items-center gap-2.5 overflow-hidden" onClick={onMobileClose}>
            <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-sm font-black text-white shadow-subtle">
              Z
            </span>
            <div
              className={cn(
                "transition-opacity duration-200 whitespace-nowrap",
                collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
              )}
            >
              <p className="text-sm font-bold leading-tight tracking-tight text-slate-900">Zebl AMS</p>
              <p className="text-[0.65rem] font-medium text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
          </Link>
          <button
            type="button"
            className="lg:hidden"
            onClick={onMobileClose}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.group} className="space-y-1">
              <p
                className={cn(
                  "mb-2 px-3 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 transition-opacity duration-200 whitespace-nowrap",
                  collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
                )}
              >
                {group.group}
              </p>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    onClick={onMobileClose}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-200",
                      collapsed ? "lg:justify-center lg:px-2 px-3" : "px-3",
                      active
                        ? "bg-slate-100 text-slate-900 font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-slate-900" : "text-slate-400")} />
                    <span
                      className={cn(
                        "transition-opacity duration-200 whitespace-nowrap",
                        collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div
            className={cn(
              "mb-2 flex items-center gap-3 rounded-lg bg-slate-50 px-2.5 py-2 border border-slate-200/60 transition-all duration-200",
              collapsed ? "lg:justify-center lg:px-2" : ""
            )}
            title={collapsed ? `${userName} (${ROLE_LABELS[role]})` : undefined}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {initials(userName)}
            </span>
            <div
              className={cn(
                "min-w-0 flex-1 transition-opacity duration-200",
                collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
              )}
            >
              <p className="truncate text-xs font-semibold text-slate-900">{userName}</p>
              <p className="truncate text-[0.6875rem] text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title={collapsed ? "Sign out" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900",
                collapsed ? "lg:justify-center lg:px-2 px-3" : "px-3"
              )}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span
                className={cn(
                  "transition-opacity duration-200 whitespace-nowrap",
                  collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
                )}
              >
                Sign out
              </span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
