-- Phase 0 foundation: RBAC, hierarchy, audit, session hardening
-- Safe for existing SQLite data; PostgreSQL-compatible types

-- Employee hierarchy
ALTER TABLE "employees" ADD COLUMN "manager_id" INTEGER REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "employees_manager_id_idx" ON "employees"("manager_id");

-- Users: SSO-ready fields (nullable password for future Microsoft login)
ALTER TABLE "users" ADD COLUMN "auth_provider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "users" ADD COLUMN "azure_oid" TEXT;
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS "users_azure_oid_key" ON "users"("azure_oid") WHERE "azure_oid" IS NOT NULL;

-- Audit logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_email" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- Leave requests: status remains TEXT (pending|approved|rejected) — Prisma enum maps to same values
CREATE INDEX IF NOT EXISTS "leave_requests_employee_id_status_idx" ON "leave_requests"("employee_id", "status");
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests"("status");

-- Attendance records index for date queries
CREATE INDEX IF NOT EXISTS "attendance_records_attendance_date_idx" ON "attendance_records"("attendance_date");

-- Users role index
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
