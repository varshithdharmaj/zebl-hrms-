-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'hr_admin', 'manager', 'employee');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('local', 'microsoft');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn', 'cancelled');

-- CreateEnum
CREATE TYPE "LeaveWorkflowStatus" AS ENUM ('submitted', 'pending_approval', 'approved', 'rejected', 'withdrawn', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('pending', 'approved', 'rejected', 'skipped');

-- CreateEnum
CREATE TYPE "ApproverRole" AS ENUM ('manager', 'skip_level_manager', 'hr_admin');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('leave_submitted', 'approval_required', 'leave_approved', 'leave_rejected', 'leave_withdrawn', 'leave_cancelled', 'escalation_reminder');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'teams', 'push', 'sms');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalTokenAction" AS ENUM ('approve', 'reject');

-- CreateEnum
CREATE TYPE "ApprovalTokenStatus" AS ENUM ('active', 'consumed', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "CalendarSyncStatus" AS ENUM ('pending', 'synced', 'failed', 'skipped', 'deleted');

-- CreateEnum
CREATE TYPE "IntegrationJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AnalyticsScope" AS ENUM ('organization', 'department', 'team', 'employee');

-- CreateEnum
CREATE TYPE "MetricPeriod" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "WorkerRunStatus" AS ENUM ('running', 'idle', 'error', 'stopped');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'employee',
    "auth_provider" "AuthProvider" NOT NULL DEFAULT 'local',
    "azure_oid" TEXT,
    "microsoft_tenant_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "profile_photo_url" TEXT,
    "auth_metadata" TEXT NOT NULL DEFAULT '{}',
    "session_version" INTEGER NOT NULL DEFAULT 1,
    "employeeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "employee_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "shift" TEXT,
    "joining_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employee_status" TEXT NOT NULL DEFAULT 'Active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "manager_id" INTEGER,
    "cached_presence" TEXT,
    "cached_presence_at" TIMESTAMP(3),
    "external_profile_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_uploads" (
    "id" SERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "upload_id" INTEGER,
    "attendance_date" TIMESTAMP(3) NOT NULL,
    "shift" TEXT,
    "check_in" TEXT,
    "check_out" TEXT,
    "work_duration" TEXT,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "leave_type" TEXT NOT NULL DEFAULT 'CL',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "workflow_status" "LeaveWorkflowStatus" NOT NULL DEFAULT 'pending_approval',
    "submitted_at" TIMESTAMP(3),
    "current_step_id" INTEGER,
    "rejection_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "final_approved_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "external_calendar_event_id" TEXT,
    "calendar_sync_status" "CalendarSyncStatus" NOT NULL DEFAULT 'pending',
    "calendar_last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_approval_steps" (
    "id" SERIAL NOT NULL,
    "leave_request_id" INTEGER NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_id" INTEGER,
    "approver_role" "ApproverRole" NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'pending',
    "acted_at" TIMESTAMP(3),
    "acted_by_user_id" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_tokens" (
    "id" TEXT NOT NULL,
    "leave_request_id" INTEGER NOT NULL,
    "approval_step_id" INTEGER NOT NULL,
    "approver_id" INTEGER,
    "approver_user_id" TEXT,
    "action" "ApprovalTokenAction" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "ApprovalTokenStatus" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "created_by" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_leave_balances" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "el_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cl_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sl_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_transactions" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "leave_type" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "created_by" TEXT,
    "leave_request_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "holiday_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "correlation_id" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "teams_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "teams_approval_cards_enabled" BOOLEAN NOT NULL DEFAULT true,
    "calendar_sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "future_teams_enabled" BOOLEAN NOT NULL DEFAULT true,
    "future_push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "leave_approval_alerts" BOOLEAN NOT NULL DEFAULT true,
    "leave_status_alerts" BOOLEAN NOT NULL DEFAULT true,
    "escalation_alerts" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "teams_webhook_url" TEXT,
    "teams_approvals_enabled" BOOLEAN NOT NULL DEFAULT true,
    "calendar_sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "org_sync_enabled" BOOLEAN NOT NULL DEFAULT false,
    "org_sync_policy" TEXT NOT NULL DEFAULT '{}',
    "escalation_hours" INTEGER NOT NULL DEFAULT 24,
    "graph_last_health_at" TIMESTAMP(3),
    "graph_last_health_status" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_jobs" (
    "id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "IntegrationJobStatus" NOT NULL DEFAULT 'pending',
    "payload" TEXT NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "correlation_id" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_escalations" (
    "id" TEXT NOT NULL,
    "leave_request_id" INTEGER NOT NULL,
    "approval_step_id" INTEGER NOT NULL,
    "escalation_type" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workforce_metrics" (
    "id" TEXT NOT NULL,
    "scope" "AnalyticsScope" NOT NULL,
    "scope_key" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "period" "MetricPeriod" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" TEXT NOT NULL,
    "snapshot_type" TEXT NOT NULL,
    "scope" "AnalyticsScope" NOT NULL,
    "scope_key" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" TEXT,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_detections" (
    "id" TEXT NOT NULL,
    "anomaly_type" TEXT NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "scope" "AnalyticsScope" NOT NULL,
    "scope_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "anomaly_detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_email" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "worker_name" TEXT NOT NULL,
    "status" "WorkerRunStatus" NOT NULL DEFAULT 'idle',
    "last_beat_at" TIMESTAMP(3) NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "last_duration_ms" INTEGER,
    "last_result" TEXT,
    "last_error" TEXT,
    "runs_total" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("worker_name")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_azure_oid_key" ON "users"("azure_oid");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE INDEX "employees_manager_id_idx" ON "employees"("manager_id");

-- CreateIndex
CREATE INDEX "employees_employee_status_idx" ON "employees"("employee_status");

-- CreateIndex
CREATE INDEX "attendance_records_attendance_date_idx" ON "attendance_records"("attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_attendance_date_key" ON "attendance_records"("employee_id", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_current_step_id_key" ON "leave_requests"("current_step_id");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_status_idx" ON "leave_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_workflow_status_idx" ON "leave_requests"("employee_id", "workflow_status");

-- CreateIndex
CREATE INDEX "leave_requests_workflow_status_idx" ON "leave_requests"("workflow_status");

-- CreateIndex
CREATE INDEX "leave_approval_steps_approver_id_status_idx" ON "leave_approval_steps"("approver_id", "status");

-- CreateIndex
CREATE INDEX "leave_approval_steps_leave_request_id_idx" ON "leave_approval_steps"("leave_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_approval_steps_leave_request_id_step_order_key" ON "leave_approval_steps"("leave_request_id", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "approval_tokens_token_hash_key" ON "approval_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "approval_tokens_token_hash_idx" ON "approval_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "approval_tokens_expires_at_idx" ON "approval_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "approval_tokens_approver_id_idx" ON "approval_tokens"("approver_id");

-- CreateIndex
CREATE INDEX "approval_tokens_approval_step_id_idx" ON "approval_tokens"("approval_step_id");

-- CreateIndex
CREATE INDEX "approval_tokens_leave_request_id_approval_step_id_idx" ON "approval_tokens"("leave_request_id", "approval_step_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_leave_balances_employee_id_key" ON "employee_leave_balances"("employee_id");

-- CreateIndex
CREATE INDEX "leave_transactions_employee_id_leave_type_idx" ON "leave_transactions"("employee_id", "leave_type");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_holiday_date_key" ON "holidays"("holiday_date");

-- CreateIndex
CREATE INDEX "notifications_status_scheduled_at_idx" ON "notifications"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "notifications_status_locked_at_idx" ON "notifications"("status", "locked_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_idx" ON "notifications"("recipient");

-- CreateIndex
CREATE INDEX "notifications_correlation_id_idx" ON "notifications"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "integration_jobs_status_scheduled_at_idx" ON "integration_jobs"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "integration_jobs_status_locked_at_idx" ON "integration_jobs"("status", "locked_at");

-- CreateIndex
CREATE INDEX "integration_jobs_job_type_idx" ON "integration_jobs"("job_type");

-- CreateIndex
CREATE INDEX "workflow_escalations_leave_request_id_idx" ON "workflow_escalations"("leave_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_escalations_approval_step_id_escalation_type_key" ON "workflow_escalations"("approval_step_id", "escalation_type");

-- CreateIndex
CREATE INDEX "workforce_metrics_scope_scope_key_idx" ON "workforce_metrics"("scope", "scope_key");

-- CreateIndex
CREATE INDEX "workforce_metrics_metric_key_period_start_idx" ON "workforce_metrics"("metric_key", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "workforce_metrics_scope_scope_key_metric_key_period_period__key" ON "workforce_metrics"("scope", "scope_key", "metric_key", "period", "period_start");

-- CreateIndex
CREATE INDEX "analytics_snapshots_snapshot_type_generated_at_idx" ON "analytics_snapshots"("snapshot_type", "generated_at");

-- CreateIndex
CREATE INDEX "analytics_snapshots_scope_scope_key_idx" ON "analytics_snapshots"("scope", "scope_key");

-- CreateIndex
CREATE INDEX "anomaly_detections_detected_at_idx" ON "anomaly_detections"("detected_at");

-- CreateIndex
CREATE INDEX "anomaly_detections_scope_scope_key_idx" ON "anomaly_detections"("scope", "scope_key");

-- CreateIndex
CREATE INDEX "anomaly_detections_anomaly_type_resolved_at_idx" ON "anomaly_detections"("anomaly_type", "resolved_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "worker_heartbeats_status_last_beat_at_idx" ON "worker_heartbeats"("status", "last_beat_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "attendance_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_current_step_id_fkey" FOREIGN KEY ("current_step_id") REFERENCES "leave_approval_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tokens" ADD CONSTRAINT "approval_tokens_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tokens" ADD CONSTRAINT "approval_tokens_approval_step_id_fkey" FOREIGN KEY ("approval_step_id") REFERENCES "leave_approval_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_escalations" ADD CONSTRAINT "workflow_escalations_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
