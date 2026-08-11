-- Permanent Recruitment ops capability on users (default false for all existing rows).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "recruitment_ops_access" BOOLEAN NOT NULL DEFAULT false;
