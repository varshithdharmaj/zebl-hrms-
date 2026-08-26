import { prisma as db } from "@/lib/prisma";
import type { AnomalyCandidate } from "@/lib/analytics/analytics-types";
import { DEFAULT_ANOMALY_THRESHOLDS } from "@/lib/analytics/analytics-types";
import type { DateRange } from "@/lib/analytics/analytics-types";

export async function detectAnomalies(range: DateRange): Promise<AnomalyCandidate[]> {
  const thresholds = DEFAULT_ANOMALY_THRESHOLDS;
  const candidates: AnomalyCandidate[] = [];

  const employees = await db.employee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, department: true },
  });

  const priorStart = new Date(range.start);
  priorStart.setDate(priorStart.getDate() - 30);

  for (const emp of employees) {
    const recent = await db.attendanceRecord.findMany({
      where: {
        employeeId: emp.id,
        attendanceDate: { gte: range.start, lte: range.end },
      },
      select: { status: true },
    });
    if (recent.length < thresholds.minSampleDays) continue;

    const absent = recent.filter((r) => r.status === "Absent").length;
    const absentPct = (absent / recent.length) * 100;
    const prior = await db.attendanceRecord.findMany({
      where: {
        employeeId: emp.id,
        attendanceDate: { gte: priorStart, lt: range.start },
      },
      select: { status: true },
    });
    const priorAbsentPct =
      prior.length > 0
        ? (prior.filter((r) => r.status === "Absent").length / prior.length) * 100
        : 0;

    if (absentPct - priorAbsentPct >= thresholds.absenteeismSpikePct) {
      candidates.push({
        anomalyType: "absenteeism_spike",
        severity: absentPct > 30 ? "high" : "medium",
        scope: "employee",
        scopeKey: String(emp.id),
        title: `Absenteeism spike: ${emp.name}`,
        description: `Absent rate ${absentPct.toFixed(1)}% vs ${priorAbsentPct.toFixed(1)}% prior baseline.`,
        explanation: `Compared ${recent.length} recent attendance days to prior 30-day window.`,
        metadata: { absentPct, priorAbsentPct },
      });
    }

    const shortHours = recent.filter((r) => r.status === "Short Hours").length;
    const shortPct = (shortHours / recent.length) * 100;
    if (shortPct >= thresholds.shortHoursRatePct) {
      candidates.push({
        anomalyType: "repeated_short_hours",
        severity: "medium",
        scope: "employee",
        scopeKey: String(emp.id),
        title: `Repeated short hours: ${emp.name}`,
        description: `${shortPct.toFixed(1)}% of days recorded as short hours.`,
        explanation: "Threshold based on operational short-hours rate limit.",
      });
    }
  }

  const deptEmployees = new Map<string, number[]>();
  for (const e of employees) {
    const d = e.department ?? "Unassigned";
    const list = deptEmployees.get(d) ?? [];
    list.push(e.id);
    deptEmployees.set(d, list);
  }

  const weekStart = new Date(range.end);
  weekStart.setDate(weekStart.getDate() - 7);
  for (const [dept, ids] of deptEmployees) {
    const cluster = await db.leaveRequest.count({
      where: {
        employeeId: { in: ids },
        startDate: { lte: range.end },
        endDate: { gte: weekStart },
        workflowStatus: { in: ["pending_approval", "approved"] },
      },
    });
    if (cluster >= thresholds.teamLeaveClusterCount) {
      candidates.push({
        anomalyType: "leave_clustering",
        severity: "medium",
        scope: "department",
        scopeKey: dept,
        title: `Leave clustering in ${dept}`,
        description: `${cluster} leave requests overlap in the current week.`,
        explanation: "Multiple concurrent leave requests may impact staffing coverage.",
        metadata: { clusterCount: cluster },
      });
    }
  }

  const managers = await db.leaveApprovalStep.groupBy({
    by: ["approverId"],
    where: {
      status: "pending",
      approverId: { not: null },
      createdAt: { lt: new Date(Date.now() - thresholds.approvalSlaHours * 3_600_000) },
    },
    _count: { id: true },
  });

  for (const m of managers) {
    if (!m.approverId || m._count.id < 2) continue;
    const approver = await db.employee.findUnique({
      where: { id: m.approverId },
      select: { name: true },
    });
    candidates.push({
      anomalyType: "approval_bottleneck",
      severity: "high",
      scope: "team",
      scopeKey: String(m.approverId),
      title: `Approval bottleneck: ${approver?.name ?? m.approverId}`,
      description: `${m._count.id} requests pending beyond ${thresholds.approvalSlaHours}h SLA.`,
      explanation: "Operational SLA based on step pending duration.",
      metadata: { pendingCount: m._count.id },
    });
  }

  return candidates;
}

export async function persistAnomalies(candidates: AnomalyCandidate[]): Promise<number> {
  let saved = 0;
  for (const c of candidates) {
    const existing = await db.anomalyDetection.findFirst({
      where: {
        anomalyType: c.anomalyType,
        scope: c.scope,
        scopeKey: c.scopeKey,
        resolvedAt: null,
      },
    });
    if (existing) continue;

    await db.anomalyDetection.create({
      data: {
        anomalyType: c.anomalyType,
        severity: c.severity,
        scope: c.scope,
        scopeKey: c.scopeKey,
        title: c.title,
        description: c.description,
        explanation: c.explanation,
        metadata: JSON.stringify(c.metadata ?? {}),
      },
    });
    saved += 1;
  }
  return saved;
}
