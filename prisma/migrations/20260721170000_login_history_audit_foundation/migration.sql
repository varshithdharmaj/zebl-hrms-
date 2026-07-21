-- CreateEnum
CREATE TYPE "LoginSessionStatus" AS ENUM ('active', 'logged_out', 'expired', 'revoked', 'failed');

-- AlterTable
ALTER TABLE "audit_logs"
  ADD COLUMN "employee_id" INTEGER,
  ADD COLUMN "module" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "old_value" JSONB,
  ADD COLUMN "new_value" JSONB,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'success',
  ADD COLUMN "ip_address" TEXT,
  ADD COLUMN "browser" TEXT,
  ADD COLUMN "device" TEXT,
  ADD COLUMN "operating_system" TEXT,
  ADD COLUMN "user_agent" TEXT;

-- CreateTable
CREATE TABLE "login_sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "employee_id" INTEGER,
  "attempted_email" TEXT,
  "login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "logout_at" TIMESTAMP(3),
  "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "LoginSessionStatus" NOT NULL DEFAULT 'active',
  "ip_address" TEXT,
  "browser" TEXT,
  "browser_version" TEXT,
  "device" TEXT,
  "operating_system" TEXT,
  "user_agent" TEXT,
  "session_token" TEXT,
  "session_duration" INTEGER,
  "failure_reason" TEXT,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "login_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_sessions_session_token_key" ON "login_sessions"("session_token");
CREATE INDEX "login_sessions_user_id_idx" ON "login_sessions"("user_id");
CREATE INDEX "login_sessions_employee_id_idx" ON "login_sessions"("employee_id");
CREATE INDEX "login_sessions_login_at_idx" ON "login_sessions"("login_at");
CREATE INDEX "login_sessions_status_idx" ON "login_sessions"("status");
CREATE INDEX "login_sessions_user_id_status_last_activity_at_idx"
  ON "login_sessions"("user_id", "status", "last_activity_at");
CREATE INDEX "login_sessions_attempted_email_login_at_idx"
  ON "login_sessions"("attempted_email", "login_at");
CREATE INDEX "audit_logs_employee_id_idx" ON "audit_logs"("employee_id");
CREATE INDEX "audit_logs_module_action_idx" ON "audit_logs"("module", "action");

-- AddForeignKey
ALTER TABLE "login_sessions"
  ADD CONSTRAINT "login_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "login_sessions"
  ADD CONSTRAINT "login_sessions_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
