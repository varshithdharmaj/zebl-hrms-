-- Migrate to the three-role authorization model: super_admin / hr / employee.
-- Existing data mapping:
--   admin    -> super_admin
--   hr_admin -> hr
--   manager  -> employee   (manager capability preserved via the Employee hierarchy, not the role)
--   employee -> employee
--
-- NOTE: This alters the `UserRole` enum in place and remaps every existing users.role
-- value. The ApproverRole enum (manager / skip_level_manager / hr_admin) is a DIFFERENT
-- type used by the leave-approval workflow and is intentionally left untouched.

-- 1. Add the user activation flag (used by Super Admin user management).
ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- 2. Build the new enum type.
CREATE TYPE "UserRole_new" AS ENUM ('super_admin', 'hr', 'employee');

-- 3. Drop the column default (it references the old enum type).
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- 4. Convert the column, remapping old values to new ones.
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE "role"::text
      WHEN 'admin' THEN 'super_admin'
      WHEN 'hr_admin' THEN 'hr'
      WHEN 'manager' THEN 'employee'
      WHEN 'employee' THEN 'employee'
    END
  )::"UserRole_new";

-- 5. Swap the enum types.
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- 6. Restore the default under the new type.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'employee';

-- 7. Supporting index for active-role lookups (last Super Admin protection, filters).
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");
