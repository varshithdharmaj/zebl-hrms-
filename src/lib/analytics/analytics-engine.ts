import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import type { ExecutiveDashboardPayload } from "@/lib/analytics/analytics-types";
import {
  computeDepartmentMetrics,
  computeManagerSlaMetrics,
  computeOrgMetrics,
  persistMetrics,
} from "@/lib/analytics/workforce-metrics";
import { buildAttendanceInsights } from "@/lib/analytics/attendance-insights";
import { buildLeaveInsights } from "@/lib/analytics/leave-insights";
import { buildOperationalSummary, buildAttendanceHeatmap } from "@/lib/analytics/operational-insights";
import { detectAnomalies, persistAnomalies } from "@/lib/analytics/anomaly-detection";
import { generateRecommendations } from "@/lib/analytics/recommendations";
import { notifyAnalyticsAlerts } from "@/lib/analytics/analytics-notifications";

export function defaultAnalyticsRange(): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start, end };
}

export async function runAnalyticsAggregation(correlationId: string): Promise<{
  metrics: number;
  anomalies: number;
  snapshotId: string;
}> {
  const range = defaultAnalyticsRange();

  const org = await computeOrgMetrics(range);
  const dept = await computeDepartmentMetrics(range);
  const mgr = await computeManagerSlaMetrics(range);
  const metricCount = await persistMetrics([...org, ...dept, ...mgr]);

  const candidates = await detectAnomalies(range);
  const anomalyCount = await persistAnomalies(candidates);

  const payload = await buildExecutiveSnapshot(range, candidates);
  const snapshot = await prisma.analyticsSnapshot.create({
    data: {
      snapshotType: "executive_summary",
      scope: "organization",
      scopeKey: "org",
      payload: JSON.stringify(payload),
      periodStart: range.start,
      periodEnd: range.end,
      correlationId,
    },
  });

  await writeAuditLog({
    entityType: "analytics",
    entityId: snapshot.id,
    action: AUDIT_ACTIONS.ANALYTICS_GENERATED,
    metadata: { correlationId, metricCount, anomalyCount },
  });

  await notifyAnalyticsAlerts(payload, correlationId);

  return { metrics: metricCount, anomalies: anomalyCount, snapshotId: snapshot.id };
}

async function buildExecutiveSnapshot(
  range: { start: Date; end: Date },
  anomalyCandidates: Awaited<ReturnType<typeof detectAnomalies>>
): Promise<ExecutiveDashboardPayload> {
  const [attendance, leave, operational] = await Promise.all([
    buildAttendanceInsights(range),
    buildLeaveInsights(range),
    buildOperationalSummary(range),
  ]);

  const openAnomalies = await prisma.anomalyDetection.findMany({
    where: { resolvedAt: null },
    orderBy: { detectedAt: "desc" },
    take: 15,
  });

  const recommendations = await generateRecommendations(range, anomalyCandidates);

  const pendingMetric = await prisma.workforceMetric.findFirst({
    where: {
      scope: "organization",
      scopeKey: "org",
      metricKey: "pending_approvals",
    },
    orderBy: { computedAt: "desc" },
  });

  return {
    generatedAt: new Date().toISOString(),
    period: range,
    workforceHealth: {
      attendanceRate: attendance.attendanceRate,
      leaveUtilization: leave.totalApprovedDays,
      pendingApprovals: pendingMetric?.value ?? 0,
      openAnomalies: openAnomalies.length,
    },
    bottlenecks: operational.bottlenecks,
    trends: operational.trends,
    departmentComparison: attendance.byDepartment.map((d) => ({
      department: d.department,
      attendanceRate: d.attendanceRate,
      leaveDays: leave.byType.reduce((s, t) => s + t.days, 0),
    })),
    heatmap: buildAttendanceHeatmap(attendance.byDepartment),
    recommendations,
    anomalies: openAnomalies.map((a) => ({
      id: a.id,
      title: a.title,
      severity: a.severity,
      description: a.description,
    })),
  };
}

export async function getLatestExecutiveSnapshot(): Promise<ExecutiveDashboardPayload | null> {
  const row = await prisma.analyticsSnapshot.findFirst({
    where: { snapshotType: "executive_summary", scope: "organization" },
    orderBy: { generatedAt: "desc" },
  });
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as ExecutiveDashboardPayload;
  } catch {
    return null;
  }
}

export async function queueNightlyAnalytics(): Promise<string> {
  const { enqueueIntegrationJob } = await import("@/lib/integrations/integration-queue");
  return enqueueIntegrationJob({
    jobType: "analytics_aggregate",
    payload: {},
    correlationId: `analytics-${Date.now()}`,
    scheduledAt: new Date(),
  });
}
