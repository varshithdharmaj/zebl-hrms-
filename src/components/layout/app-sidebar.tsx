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
  Bell,
  Plug,
  BarChart3,
  ScrollText,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CalendarClock,
  Headset,
  Briefcase,
  FileCheck,
  UserCheck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/auth";
import { NavLinkPendingHint } from "@/components/layout/nav-link-pending-hint";
import type { AppUserRole } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/roles";
import { getRoleHomePath } from "@/lib/routing";
import { buildEmployeeShellNav } from "@/lib/navigation/employee-shell-nav";
import { isSidebarNavActive } from "@/lib/recruitment/navigation/sidebar-nav-active";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { group: string; items: NavItem[] };

const RECRUITMENT_WORKSPACE_ITEMS: NavItem[] = [
  { href: "/admin/recruitment", label: "Recruitment Dashboard", icon: LayoutDashboard },
  { href: "/admin/recruitment/jobs", label: "Jobs", icon: Briefcase },
  { href: "/admin/recruitment/candidates", label: "Candidates", icon: Users },
  { href: "/admin/recruitment/pipeline", label: "Pipeline", icon: ClipboardList },
  { href: "/admin/recruitment/offers", label: "Offers", icon: FileCheck },
  { href: "/admin/recruitment/conversions", label: "Conversions", icon: UserCheck },
  { href: "/admin/recruitment/reports", label: "Reports", icon: ScrollText },
];

function recruitmentOpsOnlyNav(): NavGroup[] {
  return [
    {
      group: "Hiring Workspace",
      items: RECRUITMENT_WORKSPACE_ITEMS,
    },
    {
      group: "Workspace",
      items: [
        { href: "/employee/dashboard", label: "Employee Home", icon: LayoutDashboard },
        { href: "/employee/profile", label: "Profile", icon: UserRound },
      ],
    },
  ];
}

function groupedNavForRole(
  role: AppUserRole,
  showMyTeamGroup: boolean,
  showRecruitmentNav: boolean,
  showPanelistInterviews = false,
  recruitmentOpsOnly = false,
  showOwnWorkspaceNav = false
): NavGroup[] {
  if (recruitmentOpsOnly) {
    return recruitmentOpsOnlyNav();
  }

  switch (role) {
    case "super_admin":
    case "hr":
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
            { href: "/admin/tickets", label: "Helpdesk", icon: Headset },
            { href: "/admin/upload", label: "Upload Data", icon: Upload },
          ],
        },
        // Own attendance/leave self-service, when linked to an Employee record.
        // Deliberately just these four — My Team/tickets stay Manager/Employee-only.
        ...(showOwnWorkspaceNav
          ? [
              {
                group: "My Workspace",
                items: [
                  { href: "/employee/dashboard", label: "My Dashboard", icon: LayoutDashboard },
                  { href: "/employee/attendance", label: "My Attendance", icon: ClipboardList },
                  { href: "/employee/leaves", label: "My Leaves", icon: CalendarDays },
                  { href: "/employee/profile", label: "My Profile", icon: UserRound },
                ],
              },
            ]
          : []),
        ...(showRecruitmentNav
          ? [
              {
                group: "Hiring Workspace",
                items: RECRUITMENT_WORKSPACE_ITEMS,
              },
            ]
          : []),
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
          group: "Security",
          items: [
            { href: "/admin/security", label: "Security & Sessions", icon: ShieldCheck },
          ],
        },
        {
          group: "Settings",
          items: [
            { href: "/admin/settings", label: "System Settings", icon: Settings },
            { href: "/admin/payroll-settings", label: "Payroll Settings", icon: Settings },
            { href: "/admin/attendance-settings", label: "Attendance Settings", icon: CalendarClock },
            { href: "/admin/leave-settings", label: "Leave Settings", icon: CalendarDays },
            ...(showRecruitmentNav
              ? [
                  {
                    href: "/admin/recruitment/settings",
                    label: "Recruitment Settings",
                    icon: Settings,
                  },
                ]
              : []),
          ],
        },
        // Platform & security administration — Super Admin only.
        ...(role === "super_admin"
          ? [
              {
                group: "Platform Administration",
                items: [
                  { href: "/admin/user-management", label: "User Management", icon: ShieldCheck },
                  { href: "/admin/tickets/anonymous", label: "Anonymous Tickets", icon: Headset },
                ],
              },
            ]
          : []),
      ];
    case "employee":
    default:
      return buildEmployeeShellNav(
        showMyTeamGroup,
        showPanelistInterviews,
        showRecruitmentNav
      );
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
  showMyTeamGroup = false,
  showRecruitmentNav = false,
  showPanelistInterviews = false,
  recruitmentOpsOnly = false,
  showOwnWorkspaceNav = false,
}: {
  role: AppUserRole;
  userName: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Line-manager My Team nav group (from MyTeamNavContext.showMyTeamGroup). */
  showMyTeamGroup?: boolean;
  /** Admin: Recruitment nav (RECRUITMENT_MODULE_ENABLED). */
  showRecruitmentNav?: boolean;
  /** Employee: Interviews nav when assigned as a panelist (and recruitment is on). */
  showPanelistInterviews?: boolean;
  /** Recruitment test managers: Hiring Workspace only. */
  recruitmentOpsOnly?: boolean;
  /** HR/Super Admin linked to an Employee record: "My Workspace" nav group. */
  showOwnWorkspaceNav?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const onMobileOpen = () => setMobileOpen(true);
  const onMobileClose = () => setMobileOpen(false);
  const pathname = usePathname();
  const groups = groupedNavForRole(
    role,
    showMyTeamGroup,
    showRecruitmentNav,
    showPanelistInterviews,
    recruitmentOpsOnly,
    showOwnWorkspaceNav
  );
  const home = recruitmentOpsOnly
    ? "/admin/recruitment"
    : getRoleHomePath(role);

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
              <p className="text-sm font-bold leading-tight tracking-tight text-foreground">HRMS</p>
              <p className="text-[0.65rem] font-medium text-muted-foreground">{ROLE_LABELS[role]}</p>
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
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
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
                  "mb-2 px-3 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground transition-opacity duration-200 whitespace-nowrap",
                  collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
                )}
              >
                {group.group}
              </p>
              {group.items.map((item) => {
                const siblingHrefs = group.items.map((navItem) => navItem.href);
                const active = isSidebarNavActive(pathname, item.href, siblingHrefs);
                const Icon = item.icon;
                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    onClick={onMobileClose}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-200",
                      collapsed ? "lg:justify-center lg:px-2 px-3" : "px-3",
                      active
                        ? "bg-sidebar-accent text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
                    <span
                      className={cn(
                        "transition-opacity duration-200 whitespace-nowrap",
                        collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
                      )}
                    >
                      {item.label}
                    </span>
                    <NavLinkPendingHint collapsed={collapsed} />
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {role === "employee" ? (
            <Link
              href="/employee/profile"
              onClick={onMobileClose}
              title={collapsed ? `${userName} · Profile` : undefined}
              aria-label={`Open profile for ${userName}`}
              className={cn(
                "mb-2 flex items-center gap-3 rounded-lg bg-sidebar-accent px-2.5 py-2 border border-border/60 transition-all duration-200",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                collapsed ? "lg:justify-center lg:px-2" : ""
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                {initials(userName)}
              </span>
              <div
                className={cn(
                  "min-w-0 flex-1 transition-opacity duration-200",
                  collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
                )}
              >
                <p className="truncate text-xs font-semibold text-foreground">{userName}</p>
                <p className="truncate text-[0.6875rem] text-muted-foreground">
                  Profile · {ROLE_LABELS[role]}
                </p>
              </div>
            </Link>
          ) : (
            <div
              className={cn(
                "mb-2 flex items-center gap-3 rounded-lg bg-sidebar-accent px-2.5 py-2 border border-border/60 transition-all duration-200",
                collapsed ? "lg:justify-center lg:px-2" : ""
              )}
              title={collapsed ? `${userName} (${ROLE_LABELS[role]})` : undefined}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                {initials(userName)}
              </span>
              <div
                className={cn(
                  "min-w-0 flex-1 transition-opacity duration-200",
                  collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
                )}
              >
                <p className="truncate text-xs font-semibold text-foreground">{userName}</p>
                <p className="truncate text-[0.6875rem] text-muted-foreground">{ROLE_LABELS[role]}</p>
              </div>
            </div>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              title={collapsed ? "Sign out" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
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
