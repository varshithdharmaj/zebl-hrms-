-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM (
  'active',
  'inactive',
  'locked',
  'suspended',
  'pending',
  'terminated'
);

-- AlterTable: users
ALTER TABLE "users"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "account_status" "AccountStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "locked_at" TIMESTAMP(3),
  ADD COLUMN "locked_reason" TEXT;

UPDATE "users"
SET "account_status" = CASE
  WHEN "is_active" THEN 'active'::"AccountStatus"
  ELSE 'inactive'::"AccountStatus"
END;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_account_status_idx" ON "users"("account_status");

-- AlterTable: employees
ALTER TABLE "employees"
  ADD COLUMN "first_name" TEXT,
  ADD COLUMN "last_name" TEXT,
  ADD COLUMN "preferred_name" TEXT,
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "date_of_birth" TIMESTAMP(3),
  ADD COLUMN "alternate_phone" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "emergency_contact" TEXT,
  ADD COLUMN "employment_type" TEXT,
  ADD COLUMN "work_location" TEXT;
