import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDbConnectionHelp, isDbUnreachableError } from "@/lib/db/connection-error";
import type { RequestSecurityContext } from "@/lib/security/request-context";

export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: "auth.login.success",
  AUTH_LOGIN_FAILURE: "auth.login.failure",
  AUTH_LOGOUT: "auth.logout",
  AUTH_SSO_LOGIN_SUCCESS: "auth.sso.login.success",
  AUTH_SSO_ACCOUNT_LINKED: "auth.sso.account.linked",
  AUTH_SSO_PROVISION_DENIED: "auth.sso.provision.denied",
  AUTH_SESSION_INVALIDATED: "auth.session.invalidated",
  AUTH_PROVIDER_CHANGED: "auth.provider.changed",
  AUTH_PASSWORD_CHANGED: "auth.password.changed",
  AUTH_PASSWORD_RESET: "auth.password.reset",
  EMPLOYEE_UPDATED: "employee.updated",
  EMPLOYEE_MANAGER_ASSIGNED: "employee.manager.assigned",
  EMPLOYEE_MANAGER_REMOVED: "employee.manager.removed",
  USER_ROLE_CHANGED: "user.role.changed",
  USER_ACTIVATED: "user.activated",
  USER_DEACTIVATED: "user.deactivated",
  USER_ACCOUNT_STATUS_CHANGED: "user.account_status.changed",
  USER_ACCOUNT_LOCKED: "user.account.locked",
  USER_ACCOUNT_UNLOCKED: "user.account.unlocked",
  USER_IDENTITY_UPDATED: "user.identity.updated",
  USER_PROFILE_PHOTO_CHANGED: "user.profile_photo.changed",
  SUPER_ADMIN_CREATED: "user.super_admin.created",
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
  ATTENDANCE_SETTINGS_UPDATED: "attendance.settings.updated",
  ATTENDANCE_DATE_OVERRIDE_CREATED: "attendance.date_override.created",
  ATTENDANCE_DATE_OVERRIDE_REMOVED: "attendance.date_override.removed",
  ATTENDANCE_CLOCK_IN: "attendance.clock_in",
  ATTENDANCE_CLOCK_OUT: "attendance.clock_out",
  ATTENDANCE_REGULARIZATION: "attendance.regularization",
  ATTENDANCE_APPROVED: "attendance.approved",
  ATTENDANCE_UPLOAD_COMPLETED: "attendance.upload.completed",
  EMPLOYEE_CREATED: "employee.created",
  EMPLOYEE_DELETED: "employee.deleted",
  EMPLOYEE_DEPARTMENT_CHANGED: "employee.department.changed",
  PAYROLL_GENERATED: "payroll.generated",
  PAYROLL_DOWNLOADED: "payroll.downloaded",
  DOCUMENT_UPLOADED: "document.uploaded",
  DOCUMENT_DELETED: "document.deleted",
  DOCUMENT_DOWNLOADED: "document.downloaded",
  TICKET_ANONYMOUS_VIEWED: "ticket.anonymous.viewed",
  TICKET_CREATED: "ticket.created",
  TICKET_CREATED_ANONYMOUS: "ticket.created.anonymous",
  TICKET_UPDATED: "ticket.updated",
  TICKET_STATUS_CHANGED: "ticket.status.changed",
  TICKET_ASSIGNED: "ticket.assigned",
  TICKET_PRIORITY_CHANGED: "ticket.priority.changed",
  TICKET_HR_UPDATE_ADDED: "ticket.update.added",
  TICKET_INTERNAL_NOTE_ADDED: "ticket.internal_note.added",
  TICKET_EMPLOYEE_REPLY_ADDED: "ticket.reply.added",
  TICKET_ATTACHMENT_UPLOADED: "ticket.attachment.uploaded",
  TICKET_RESOLVED: "ticket.resolved",
  TICKET_REOPENED: "ticket.reopened",
  TICKET_CLOSED: "ticket.closed",
  TICKET_CANCELED: "ticket.canceled",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditMetadata = Record<string, unknown>;

export type WriteAuditLogInput = {
  entityType: string;
  entityId: string;
  action: AuditAction | string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  employeeId?: number | null;
  module?: string | null;
  description?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  metadata?: AuditMetadata;
  status?: string;
  requestContext?: Partial<RequestSecurityContext>;
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
        employeeId: input.employeeId ?? null,
        module: input.module ?? input.entityType,
        description: input.description ?? null,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        metadata: serializeMetadata(input.metadata ?? {}),
        status: input.status ?? "success",
        ipAddress: input.requestContext?.ipAddress ?? null,
        browser: input.requestContext?.browser ?? null,
        device: input.requestContext?.device ?? null,
        operatingSystem: input.requestContext?.operatingSystem ?? null,
        userAgent: input.requestContext?.userAgent ?? null,
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

