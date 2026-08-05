export type MyTeamAttentionDto = {
  pendingCount: number;
  overdueCount: number;
  /** Human-readable SLA summary when pending items exist. */
  slaLabel: string | null;
  error: boolean;
};

export type MyTeamAbsentPersonDto = {
  employeeId: number;
  name: string;
  leaveType: string;
};

export type MyTeamAbsentTodayDto = {
  items: MyTeamAbsentPersonDto[];
  error: boolean;
};

export type MyTeamPresenceDto = {
  present: number;
  onLeave: number;
  unknown: number;
  error: boolean;
};

export type MyTeamQuickActionDto = {
  href: string;
  label: string;
};

export type MyTeamOverviewDto = {
  directReportCount: number;
  attention: MyTeamAttentionDto;
  absentToday: MyTeamAbsentTodayDto;
  presence: MyTeamPresenceDto;
  quickActions: MyTeamQuickActionDto[];
};

export const MY_TEAM_QUICK_ACTIONS: MyTeamQuickActionDto[] = [
  { href: "/employee/approvals", label: "Open Approvals" },
  { href: "/employee/team/people", label: "People" },
  { href: "/employee/team/attendance", label: "Attendance" },
  { href: "/employee/team/leave", label: "Leave" },
  { href: "/employee/team/calendar", label: "Calendar" },
];
