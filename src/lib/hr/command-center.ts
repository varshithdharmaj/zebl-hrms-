import { LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getNotificationStats } from "@/lib/notifications/admin-queries";
import { getIntegrationSettings } from "@/lib/integrations/integration-settings";
import { getStuckWorkflowCount } from "@/lib/workflow/workflow-integrity";
import { getPendingHrApprovals } from "@/lib/workflow/pending-approvals";
import { getLeaveOverlapWarnings } from "@/lib/leave/leave-overlap";

const EMPTY_WORKFLOW_STUCK = 0;

async function safeLoad<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[HrCommandCenter] ${label} failed`, error);
    return fallback;
  }
}

export async function getHrCommandCenterData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    pendingHr,
    notificationStats,
    integrationSettings,
    workflowStuckCount,
    absenceSnapshot,
    onLeaveToday,
  ] = await Promise.all([
    safeLoad("pendingHr", [], getPendingHrApprovals),
    safeLoad("notificationStats", { pending: 0, failed: 0, sent: 0 }, getNotificationStats),
    safeLoad("integrationSettings", { escalationHours: 24, graphLastHealthStatus: null }, async () => {
      const s = await getIntegrationSettings();
      return {
        escalationHours: s.escalationHours,
        graphLastHealthStatus: s.graphLastHealthStatus,
      };
    }),
    // Dashboard UI only shows stuck count — not the full integrity issue list (Operations does).
    safeLoad("workflowStuckCount", EMPTY_WORKFLOW_STUCK, getStuckWorkflowCount),
    safeLoad("absenceSnapshot", { absentToday: 0, departmentsShortStaffed: [] }, () =>
      getAbsenceSnapshot(today, tomorrow)
    ),
    safeLoad("onLeaveToday", [], () =>
      prisma.leaveRequest.findMany({
        where: {
          workflowStatus: LeaveWorkflowStatus.approved,
          startDate: { lt: tomorrow },
          endDate: { gte: today },
        },
        include: { employee: { select: { name: true, department: true } } },
        take: 15,
      })
    ),
  ]);

  const { absentToday, departmentsShortStaffed } = absenceSnapshot;
  const failedNotifications = notificationStats.failed;

  const escalationRisk = pendingHr.filter((l) => {
    if (!l.submittedAt) return false;
    const hours = (Date.now() - l.submittedAt.getTime()) / (1000 * 60 * 60);
    return hours >= integrationSettings.escalationHours;
  });

  const conflictSamples = await Promise.all(
    pendingHr.slice(0, 5).map(async (leave) => {
      const warnings = await safeLoad(`overlap-${leave.id}`, [], () =>
        getLeaveOverlapWarnings({
          leaveRequestId: leave.id,
          employeeId: leave.employeeId,
          department: leave.employee.department,
          startDate: leave.startDate,
          endDate: leave.endDate,
        })
      );
      return {
        leaveId: leave.id,
        employeeName: leave.employee.name,
        warnings,
      };
    })
  );

  const leaveConflicts = conflictSamples.filter((c) => c.warnings.length > 0);

  return {
    pendingApprovals: pendingHr.length,
    escalationRisk: escalationRisk.length,
    escalationItems: escalationRisk.slice(0, 5).map((l) => ({
      id: l.id,
      employeeName: l.employee.name,
      leaveType: l.leaveType,
      submittedAt: l.submittedAt?.toISOString() ?? null,
    })),
    absentToday,
    onLeaveToday: onLeaveToday.map((l) => ({
      id: l.id,
      name: l.employee.name,
      department: l.employee.department,
      leaveType: l.leaveType,
    })),
    failedNotifications,
    notificationPending: notificationStats.pending,
    graphHealth: integrationSettings.graphLastHealthStatus,
    // Preserved for callers; command-center UI does not render issue rows.
    workflowIssues: [] as { leaveRequestId: number; code: string; message: string; severity: string }[],
    workflowStuckCount,
    leaveConflicts,
    departmentsShortStaffed,
  };
}

/**
 * Absent-today KPI + short-staffed departments via DB aggregation (no row hydration).
 * Semantics match buildAbsenceSnapshotFromRecords (null department → "Unassigned", ≥2, top 5).
 */
async function getAbsenceSnapshot(today: Date, tomorrow: Date) {
  const rows = await prisma.$queryRaw<Array<{ department: string; absent_count: number }>>(
    Prisma.sql`
      SELECT
        COALESCE(e.department, 'Unassigned') AS department,
        COUNT(*)::int AS absent_count
      FROM attendance_records a
      INNER JOIN employees e ON e.id = a.employee_id
      WHERE a.attendance_date >= ${today}
        AND a.attendance_date < ${tomorrow}
        AND a.status = 'Absent'
      GROUP BY COALESCE(e.department, 'Unassigned')
    `
  );

  return buildAbsenceSnapshotFromDeptCounts(
    rows.map((r) => ({ department: r.department, absentCount: r.absent_count }))
  );
}

/** Pure aggregation from per-department counts — exported for unit tests / reuse. */
export function buildAbsenceSnapshotFromDeptCounts(
  deptCounts: { department: string; absentCount: number }[]
) {
  const absentToday = deptCounts.reduce((sum, d) => sum + d.absentCount, 0);

  const departmentsShortStaffed = [...deptCounts]
    .filter((d) => d.absentCount >= 2)
    .sort((a, b) => b.absentCount - a.absentCount)
    .slice(0, 5)
    .map((d) => ({ department: d.department, absentCount: d.absentCount }));

  return {
    absentToday,
    departmentsShortStaffed,
  };
}

/**
 * @deprecated Prefer {@link buildAbsenceSnapshotFromDeptCounts} for new code.
 * Kept so existing tests / callers that expand raw attendance rows still work.
 */
export function buildAbsenceSnapshotFromRecords(
  records: { employee: { department: string | null } }[]
) {
  const byDept = new Map<string, number>();
  for (const r of records) {
    const dept = r.employee.department ?? "Unassigned";
    byDept.set(dept, (byDept.get(dept) ?? 0) + 1);
  }

  return buildAbsenceSnapshotFromDeptCounts(
    [...byDept.entries()].map(([department, absentCount]) => ({ department, absentCount }))
  );
}
