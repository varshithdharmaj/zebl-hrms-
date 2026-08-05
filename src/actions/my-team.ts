"use server";

import { getSession } from "@/lib/auth";
import { canAccessEmployeeShell, PermissionError } from "@/lib/permissions";
import { getMyTeamOverview } from "@/lib/manager/dashboard-service";
import type { MyTeamOverviewDto } from "@/lib/manager/dashboard-types";
import {
  getMyTeamPerson,
  listMyTeamPeople,
  type ListMyTeamPeopleParams,
  type MyTeamPeopleListResult,
  type MyTeamPersonDetail,
} from "@/lib/manager/team-people-query";
import {
  listMyTeamAttendance,
  type ListMyTeamAttendanceParams,
  type MyTeamAttendanceListResult,
} from "@/lib/manager/team-attendance-query";
import {
  getMyTeamLeaveOverview,
  type MyTeamLeaveOverviewDto,
} from "@/lib/manager/team-leave-query";
import {
  getMyTeamCalendar,
  type GetMyTeamCalendarParams,
  type MyTeamCalendarDto,
} from "@/lib/manager/team-calendar-query";

export type GetMyTeamOverviewResult =
  | { ok: true; data: MyTeamOverviewDto }
  | { ok: false; error: string };

export type ListMyTeamPeopleResult =
  | { ok: true; data: MyTeamPeopleListResult }
  | { ok: false; error: string };

export type GetMyTeamPersonResult =
  | { ok: true; data: MyTeamPersonDetail }
  | { ok: false; error: string };

export type ListMyTeamAttendanceResult =
  | { ok: true; data: MyTeamAttendanceListResult }
  | { ok: false; error: string };

export type ListMyTeamLeaveOverviewResult =
  | { ok: true; data: MyTeamLeaveOverviewDto }
  | { ok: false; error: string };

export type ListMyTeamCalendarResult =
  | { ok: true; data: MyTeamCalendarDto }
  | { ok: false; error: string };

/**
 * My Team Overview (P0) dashboard payload for the signed-in line manager.
 */
export async function getMyTeamOverviewAction(): Promise<GetMyTeamOverviewResult> {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    return { ok: false, error: "Unauthorized." };
  }

  try {
    const data = await getMyTeamOverview(session);
    if (!data) {
      return { ok: false, error: "My Team overview is only available to line managers." };
    }
    return { ok: true, data };
  } catch (err) {
    console.error("[zebl] getMyTeamOverviewAction failed:", err);
    return { ok: false, error: "Failed to load My Team overview." };
  }
}

export async function listMyTeamPeopleAction(
  params: ListMyTeamPeopleParams = {}
): Promise<ListMyTeamPeopleResult> {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    return { ok: false, error: "Unauthorized." };
  }

  try {
    const data = await listMyTeamPeople(session.employeeId, params);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: err.message };
    }
    console.error("[zebl] listMyTeamPeopleAction failed:", err);
    return { ok: false, error: "Failed to load team people." };
  }
}

export async function getMyTeamPersonAction(
  employeeId: number
): Promise<GetMyTeamPersonResult> {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    return { ok: false, error: "Unauthorized." };
  }

  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return { ok: false, error: "Invalid employee." };
  }

  try {
    const data = await getMyTeamPerson(session.employeeId, employeeId);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: "Employee not found in your team." };
    }
    console.error("[zebl] getMyTeamPersonAction failed:", err);
    return { ok: false, error: "Failed to load team member." };
  }
}

export async function listMyTeamAttendanceAction(
  params: ListMyTeamAttendanceParams = {}
): Promise<ListMyTeamAttendanceResult> {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    return { ok: false, error: "Unauthorized." };
  }

  try {
    const data = await listMyTeamAttendance(session.employeeId, params);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: err.message };
    }
    console.error("[zebl] listMyTeamAttendanceAction failed:", err);
    return { ok: false, error: "Failed to load team attendance." };
  }
}

export async function listMyTeamLeaveOverviewAction(): Promise<ListMyTeamLeaveOverviewResult> {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    return { ok: false, error: "Unauthorized." };
  }

  try {
    const data = await getMyTeamLeaveOverview(session.employeeId);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: err.message };
    }
    console.error("[zebl] listMyTeamLeaveOverviewAction failed:", err);
    return { ok: false, error: "Failed to load team leave." };
  }
}

export async function listMyTeamCalendarAction(
  params: GetMyTeamCalendarParams = {}
): Promise<ListMyTeamCalendarResult> {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    return { ok: false, error: "Unauthorized." };
  }

  try {
    const data = await getMyTeamCalendar(session.employeeId, params);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof PermissionError) {
      return { ok: false, error: err.message };
    }
    console.error("[zebl] listMyTeamCalendarAction failed:", err);
    return { ok: false, error: "Failed to load team calendar." };
  }
}
