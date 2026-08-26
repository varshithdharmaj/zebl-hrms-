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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/auth";
import type { AppUserRole } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/roles";
import { getRoleHomePath } from "@/lib/routing";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/upload", label: "Upload", icon: Upload },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/admin/payroll-attendance", label: "Payroll attendance", icon: Banknote },
  { href: "/admin/leaves", label: "Leaves", icon: CalendarDays },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/integrations", label: "Integrations", icon: Plug },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/operations", label: "Operations", icon: Activity },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/payroll-settings", label: "Payroll settings", icon: Settings },
];

const employeeNav: NavItem[] = [
  { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee/attendance", label: "History", icon: History },
  { href: "/employee/leaves", label: "Leaves", icon: CalendarDays },
  { href: "/employee/settings", label: "Settings", icon: History },
];

const managerNav: NavItem[] = [
  { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/approvals", label: "Approvals", icon: UserCheck },
];

function navForRole(role: AppUserRole): NavItem[] {
  switch (role) {
    case "admin":
    case "hr_admin":
      return adminNav;
    case "manager":
      return [...managerNav, { href: "/manager/settings", label: "Settings", icon: Settings }];
    case "employee":
      return employeeNav;
    default:
      return employeeNav;
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
}: {
  role: AppUserRole;
  userName: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const onMobileOpen = () => setMobileOpen(true);
  const onMobileClose = () => setMobileOpen(false);
  const pathname = usePathname();
  const nav = navForRole(role);
  const home = getRoleHomePath(role);

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-sidebar-border bg-card text-foreground shadow-card lg:hidden"
        onClick={onMobileOpen}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-[2px] lg:hidden"
          onClick={onMobileClose}
          aria-label="Close overlay"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <Link href={home} className="flex items-center gap-2" onClick={onMobileClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              Z
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Zebl AMS</p>
              <p className="text-[0.65rem] text-sidebar-muted">{ROLE_LABELS[role]}</p>
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
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-sidebar-muted">
            {role === "admin" || role === "hr_admin" ? "Admin" : role === "manager" ? "Manager" : "Menu"}
          </p>
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-sidebar-accent/40 px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {initials(userName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="truncate text-xs text-sidebar-muted">{ROLE_LABELS[role]}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
