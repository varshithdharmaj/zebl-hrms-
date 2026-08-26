import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDbConnectionHelp, isDbUnreachableError } from "@/lib/db/connection-error";

export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: "auth.login.success",
  AUTH_LOGIN_FAILURE: "auth.login.failure",
  AUTH_LOGOUT: "auth.logout",
  AUTH_SSO_LOGIN_SUCCESS: "auth.sso.login.success",
  AUTH_SSO_ACCOUNT_LINKED: "auth.sso.account.linked",
  AUTH_SSO_PROVISION_DENIED: "auth.sso.provision.denied",
  AUTH_SESSION_INVALIDATED: "auth.session.invalidated",
  AUTH_PROVIDER_CHANGED: "auth.provider.changed",
  EMPLOYEE_UPDATED: "employee.updated",
  EMPLOYEE_MANAGER_ASSIGNED: "employee.manager.assigned",
  EMPLOYEE_MANAGER_REMOVED: "employee.manager.removed",
  USER_ROLE_CHANGED: "user.role.changed",
  LEAVE_STATUS_CHANGED: "leave.status.changed",
  LEAVE_SUBMITTED: "leave.submitted",
  LEAVE_STEP_APPROVED: "leave.step.approved",
  LEAVE_REJECTED: "leave.rejected",
  LEAVE_WITHDRAWN: "leave.withdrawn",
  LEAVE_CANCELLED: "leave.cancelled",
  NOTIFICATION_QUEUED: "notification.queued",
  NOTIFICATION_SENT: "notification.sent",
  NOTIFICATION_FAILED: "notification.failed",
  NOTIFICATION_RETRIED: "notification.retried",
  NOTIFICATION_CANCELLED: "notification.cancelled",
  TOKEN_CREATED: "approval.token.created",
  TOKEN_VIEWED: "approval.token.viewed",
  TOKEN_CONSUMED: "approval.token.consumed",
  TOKEN_EXPIRED: "approval.token.expired",
  TOKEN_REVOKED: "approval.token.revoked",
  APPROVAL_VIA_EMAIL: "approval.executed.email",
  REJECTION_VIA_EMAIL: "rejection.executed.email",
  CALENDAR_SYNC_SUCCESS: "calendar.sync.success",
  CALENDAR_SYNC_FAILED: "calendar.sync.failed",
  CALENDAR_SYNC_DELETED: "calendar.sync.deleted",
  TEAMS_NOTIFICATION_SENT: "teams.notification.sent",
  TEAMS_NOTIFICATION_FAILED: "teams.notification.failed",
  TEAMS_APPROVAL_EXECUTED: "teams.approval.executed",
  WORKFLOW_ESCALATED: "workflow.escalated",
  ORG_SYNC_COMPLETED: "org.sync.completed",
  INTEGRATION_JOB_QUEUED: "integration.job.queued",
  INTEGRATION_JOB_FAILED: "integration.job.failed",
  INTEGRATION_JOB_RETRIED: "integration.job.retried",
  GRAPH_API_FAILURE: "graph.api.failure",
  ANALYTICS_GENERATED: "analytics.generated",
  ANOMALY_DETECTED: "analytics.anomaly.detected",
  ANALYTICS_REPORT_EXPORTED: "analytics.report.exported",
  ANALYTICS_DASHBOARD_VIEWED: "analytics.dashboard.viewed",
  RECOMMENDATIONS_GENERATED: "analytics.recommendations.generated",
  PAYROLL_SETTINGS_UPDATED: "payroll.settings.updated",
  PAYROLL_HR_DECISION_UPDATED: "payroll.hr_decision.updated",
  PAYROLL_REPORT_EXPORTED: "payroll.report.exported",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditMetadata = Record<string, unknown>;

export type WriteAuditLogInput = {
  entityType: string;
  entityId: string;
  action: AuditAction | string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  metadata?: AuditMetadata;
};

function serializeMetadata(metadata: AuditMetadata): string {
  return JSON.stringify(metadata);
}

export async function writeAuditLog(
  input: WriteAuditLogInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  try {
    await client.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        metadata: serializeMetadata(input.metadata ?? {}),
      },
    });
  } catch (e) {
    if (isDbUnreachableError(e)) {
      console.error("[zebl] Audit log skipped — database unreachable.");
      console.error(formatDbConnectionHelp());
      return;
    }
    throw e;
  }
}

