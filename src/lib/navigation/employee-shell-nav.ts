import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CalendarDays,
  History,
  Settings,
  UserCheck,
  ShieldCheck,
  Headset,
  Briefcase,
  UserRound,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export type EmployeeNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type EmployeeNavGroup = {
  group: string;
  items: EmployeeNavItem[];
};

const WORKSPACE_ITEMS: EmployeeNavItem[] = [
  { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee/profile", label: "Profile", icon: UserRound },
  { href: "/employee/attendance", label: "History", icon: History },
  { href: "/employee/leaves", label: "Leaves", icon: CalendarDays },
  { href: "/employee/leaves/policy", label: "Leave Policy", icon: BookOpen },
  { href: "/employee/tickets", label: "My Tickets", icon: Headset },
  { href: "/employee/settings", label: "Settings", icon: Settings },
];

const MY_TEAM_ITEMS: EmployeeNavItem[] = [
  { href: "/employee/team", label: "Overview", icon: LayoutDashboard },
  { href: "/employee/approvals", label: "Approvals", icon: UserCheck },
  { href: "/employee/team/people", label: "People", icon: Users },
  { href: "/employee/team/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/employee/team/leave", label: "Leave", icon: CalendarDays },
  { href: "/employee/team/calendar", label: "Calendar", icon: CalendarDays },
];

const SECURITY_ITEMS: EmployeeNavItem[] = [
  { href: "/employee/security", label: "Security & Sessions", icon: ShieldCheck },
];

/**
 * Pure employee-shell nav groups for the sidebar.
 * My Team appears only when {@link showMyTeamGroup} is true (Phase 2 nav context).
 */
export function buildEmployeeShellNav(
  showMyTeamGroup: boolean,
  showPanelistInterviews = false,
  showRecruitmentOpsLink = false
): EmployeeNavGroup[] {
  const workspaceItems = [...WORKSPACE_ITEMS];
  // Prefer full Recruitment workspace when present — avoid duplicate Interviews entry.
  if (showRecruitmentOpsLink) {
    workspaceItems.splice(1, 0, {
      href: "/admin/recruitment",
      label: "Recruitment",
      icon: Briefcase,
    });
  } else if (showPanelistInterviews) {
    workspaceItems.splice(1, 0, {
      href: "/employee/interviews",
      label: "Interviews",
      icon: Briefcase,
    });
  }

  const groups: EmployeeNavGroup[] = [
    {
      group: "Workspace",
      items: workspaceItems,
    },
  ];

  if (showMyTeamGroup) {
    groups.push({
      group: "My Team",
      items: MY_TEAM_ITEMS,
    });
  }

  groups.push({
    group: "Security",
    items: SECURITY_ITEMS,
  });

  return groups;
}
