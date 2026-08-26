import type { AnalyticsScope, AnomalySeverity, MetricPeriod } from "@prisma/client";

export type { AnalyticsScope, AnomalySeverity, MetricPeriod };

export const METRIC_KEYS = {
  ATTENDANCE_RATE: "attendance_rate",
  PUNCTUALITY_RATE: "punctuality_rate",
  ABSENTEEISM_RATE: "absenteeism_rate",
  LEAVE_UTILIZATION: "leave_utilization",
  APPROVAL_TURNAROUND_HOURS: "approval_turnaround_hours",
  MANAGER_SLA_COMPLIANCE: "manager_sla_compliance",
  OVERTIME_MINUTES_AVG: "overtime_minutes_avg",
  STAFFING_COVERAGE: "staffing_coverage",
  ESCALATION_FREQUENCY: "escalation_frequency",
  PENDING_APPROVALS: "pending_approvals",
} as const;

export type MetricKey = (typeof METRIC_KEYS)[keyof typeof METRIC_KEYS];

export type DateRange = {
  start: Date;
  end: Date;
};

export type MetricInput = {
  scope: AnalyticsScope;
  scopeKey: string;
  metricKey: MetricKey;
  period: MetricPeriod;
  periodStart: Date;
  periodEnd: Date;
  value: number;
  metadata?: Record<string, unknown>;
};

export type AnomalyCandidate = {
  anomalyType: string;
  severity: AnomalySeverity;
  scope: AnalyticsScope;
  scopeKey: string;
  title: string;
  description: string;
  explanation: string;
  metadata?: Record<string, unknown>;
};

export type Recommendation = {
  id: string;
  category: "staffing" | "workflow" | "escalation" | "leave_planning" | "attendance";
  priority: "low" | "medium" | "high";
  title: string;
  detail: string;
  rationale: string;
  scope: AnalyticsScope;
  scopeKey: string;
};

export type ExecutiveDashboardPayload = {
  generatedAt: string;
  period: DateRange;
  workforceHealth: {
    attendanceRate: number;
    leaveUtilization: number;
    pendingApprovals: number;
    openAnomalies: number;
  };
  bottlenecks: {
    slowApprovers: { managerId: number; name: string; avgHours: number }[];
    stuckWorkflows: number;
    escalationCount: number;
  };
  trends: {
    approvalTurnaroundDeltaPct: number;
    absenteeismDeltaPct: number;
    projectedStaffingRisks: string[];
  };
  departmentComparison: { department: string; attendanceRate: number; leaveDays: number }[];
  heatmap: { department: string; week: string; absentRate: number }[];
  recommendations: Recommendation[];
  anomalies: { id: string; title: string; severity: string; description: string }[];
};

export type ApprovalInsightPayload = {
  leaveRequestId: number;
  employeeName: string;
  leaveSummary: string;
  history: {
    approvedLeavesLast12m: number;
    rejectedLeavesLast12m: number;
    avgDaysPerRequest: number;
  };
  teamImpact: {
    overlappingLeaves: { name: string; dates: string }[];
    teamLeaveDaysThisMonth: number;
    staffingWarning: string | null;
  };
  workload: {
    burnoutIndicator: "low" | "medium" | "high";
    rationale: string;
  };
  recommendations: string[];
};

export const DEFAULT_ANOMALY_THRESHOLDS = {
  absenteeismSpikePct: 15,
  shortHoursRatePct: 25,
  teamLeaveClusterCount: 3,
  approvalSlaHours: 48,
  turnaroundIncreasePct: 20,
  minSampleDays: 5,
};
