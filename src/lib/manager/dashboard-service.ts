import { LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PeopleScopeEngine } from "@/lib/people-scope/engine";
import type { SessionUser } from "@/lib/session";
import { startOfDay } from "@/lib/utils";
import { getPendingApprovalsForActor } from "@/lib/workflow/pending-approvals";
import { computeSlaState, getEscalationSlaHours } from "@/lib/workflow/workflow-sla";
import {
  MY_TEAM_QUICK_ACTIONS,
  type MyTeamAbsentTodayDto,
  type MyTeamAttentionDto,
  type MyTeamOverviewDto,
  type MyTeamPresenceDto,
} from "@/lib/manager/dashboard-types";

async function softFail<T>(
  load: () => Promise<T>,
  fallback: T
): Promise<T & { error: boolean }> {
  try {
    const data = await load();
    return { ...data, error: false };
  } catch (err) {
    console.error("[zebl] My Team overview widget failed:", err);
    return { ...fallback, error: true };
  }
}

async function loadAttention(session: SessionUser): Promise<Omit<MyTeamAttentionDto, "error">> {
  const [leaves, slaHours] = await Promise.all([
    getPendingApprovalsForActor(session),
    getEscalationSlaHours(),
  ]);

  let overdueCount = 0;
  let worst: ReturnType<typeof computeSlaState> | null = null;

  for (const leave of leaves) {
    const sla = computeSlaState(leave.submittedAt, slaHours);
    if (sla.overdue) overdueCount += 1;

    if (!worst) {
      worst = sla;
      continue;
    }
    if (sla.overdue && !worst.overdue) {
      worst = sla;
    } else if (
      sla.overdue === worst.overdue &&
      (sla.hoursRemaining ?? Number.POSITIVE_INFINITY) <
        (worst.hoursRemaining ?? Number.POSITIVE_INFINITY)
    ) {
      worst = sla;
    }
  }

  return {
    pendingCount: leaves.length,
    overdueCount,
    slaLabel: leaves.length === 0 ? null : worst?.label ?? null,
  };
}

async function loadAbsentToday(employeeIds: number[]): Promise<Omit<MyTeamAbsentTodayDto, "error">> {
  if (employeeIds.length === 0) {
    return { items: [] };
  }

  const today = startOfDay();
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: employeeIds },
      workflowStatus: LeaveWorkflowStatus.approved,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    select: {
      leaveType: true,
      employee: { select: { id: true, name: true } },
    },
    orderBy: { employee: { name: "asc" } },
  });

  // One row per employee (first leave type if overlapping).
  const byEmployee = new Map<number, { employeeId: number; name: string; leaveType: string }>();
  for (const row of leaves) {
    if (!byEmployee.has(row.employee.id)) {
      byEmployee.set(row.employee.id, {
        employeeId: row.employee.id,
        name: row.employee.name,
        leaveType: row.leaveType,
      });
    }
  }

  return { items: [...byEmployee.values()] };
}

async function loadPresence(
  employeeIds: number[],
  onLeaveIds: Set<number>
): Promise<Omit<MyTeamPresenceDto, "error">> {
  if (employeeIds.length === 0) {
    return { present: 0, onLeave: 0, unknown: 0 };
  }

  const today = startOfDay();
  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      attendanceDate: today,
    },
    select: { employeeId: true },
  });
  const presentIds = new Set(records.map((r) => r.employeeId));

  let present = 0;
  let onLeave = 0;
  let unknown = 0;

  for (const id of employeeIds) {
    if (onLeaveIds.has(id)) {
      onLeave += 1;
    } else if (presentIds.has(id)) {
      present += 1;
    } else {
      unknown += 1;
    }
  }

  return { present, onLeave, unknown };
}

/**
 * My Team Overview dashboard data (P0 widgets).
 * Scope always from {@link PeopleScopeEngine} — never raw managerId filters here.
 */
export async function getMyTeamOverview(session: SessionUser): Promise<MyTeamOverviewDto | null> {
  if (session.employeeId == null) return null;

  const isManager = await PeopleScopeEngine.isLineManager(session.employeeId);
  if (!isManager) return null;

  const scope = await PeopleScopeEngine.resolveScope(session.employeeId);
  const employeeIds = scope.employeeIds;

  const attention = await softFail(
    () => loadAttention(session),
    { pendingCount: 0, overdueCount: 0, slaLabel: null }
  );

  const absentToday = await softFail(
    () => loadAbsentToday(employeeIds),
    { items: [] as MyTeamAbsentTodayDto["items"] }
  );

  const onLeaveIds = new Set(absentToday.items.map((i) => i.employeeId));
  const presence = await softFail(
    () => loadPresence(employeeIds, onLeaveIds),
    { present: 0, onLeave: 0, unknown: employeeIds.length }
  );

  return {
    directReportCount: employeeIds.length,
    attention,
    absentToday,
    presence,
    quickActions: MY_TEAM_QUICK_ACTIONS,
  };
}
