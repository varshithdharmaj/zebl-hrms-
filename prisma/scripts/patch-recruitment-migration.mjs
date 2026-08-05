import fs from "node:fs";

const path =
  "prisma/migrations/20260804150000_recruitment_foundation/migration.sql";
let sql = fs.readFileSync(path, "utf8");

sql = sql.replace(
  /ALTER TYPE "NotificationType" ADD VALUE '([^']+)';/g,
  'ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS \'$1\';'
);

sql = sql.replace(
  /-- CreateEnum\r?\nCREATE TYPE "([^"]+)" AS ENUM \(([^;]+)\);/g,
  (_match, name, values) =>
    `-- CreateEnum\nDO $$ BEGIN\n  CREATE TYPE "${name}" AS ENUM (${values});\nEXCEPTION\n  WHEN duplicate_object THEN NULL;\nEND $$;`
);

const extras = `

-- =============================================================================
-- Partial unique indexes (Prisma cannot express these)
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "candidates_email_live_unique"
  ON "candidates" (lower("email"))
  WHERE "deleted_at" IS NULL
    AND "email" IS NOT NULL
    AND "merged_into_candidate_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_applications_active_candidate_job_unique"
  ON "recruitment_applications" ("candidate_id", "job_opening_id")
  WHERE "deleted_at" IS NULL
    AND "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "hiring_team_members_one_hm_per_job"
  ON "hiring_team_members" ("job_opening_id")
  WHERE "role" = 'hiring_manager';

CREATE UNIQUE INDEX IF NOT EXISTS "hiring_decisions_one_current_per_application"
  ON "hiring_decisions" ("application_id")
  WHERE "is_current" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_documents_one_primary_resume"
  ON "candidate_documents" ("candidate_id")
  WHERE "document_type" = 'resume'
    AND "is_primary" = true
    AND "deleted_at" IS NULL;

-- =============================================================================
-- Seed: default pipeline template + settings singleton
-- =============================================================================

INSERT INTO "recruitment_pipeline_templates" ("id", "name", "description", "is_system", "is_active", "created_at", "updated_at")
VALUES (
  'recruitment_default_pipeline_v1',
  'Default Hiring Pipeline',
  'System default recruitment pipeline (Phase 0 seed)',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "recruitment_pipeline_template_stages" ("id", "template_id", "stage", "sort_order", "is_optional", "label", "sla_days")
VALUES
  ('rpts_resume_received', 'recruitment_default_pipeline_v1', 'resume_received', 10, false, 'Resume Received', 2),
  ('rpts_screening', 'recruitment_default_pipeline_v1', 'screening', 20, false, 'Screening', 3),
  ('rpts_assessment', 'recruitment_default_pipeline_v1', 'assessment', 30, true, 'Assessment', 5),
  ('rpts_hr_round', 'recruitment_default_pipeline_v1', 'hr_round', 40, true, 'HR Round', 5),
  ('rpts_technical_round', 'recruitment_default_pipeline_v1', 'technical_round', 50, true, 'Technical Round', 5),
  ('rpts_team_lead_round', 'recruitment_default_pipeline_v1', 'team_lead_round', 60, true, 'Team Lead Round', 5),
  ('rpts_manager_round', 'recruitment_default_pipeline_v1', 'manager_round', 70, false, 'Manager Round', 5),
  ('rpts_client_round', 'recruitment_default_pipeline_v1', 'client_round', 80, true, 'Client Round', 5),
  ('rpts_reference_check', 'recruitment_default_pipeline_v1', 'reference_check', 90, true, 'Reference Check', 5),
  ('rpts_decision', 'recruitment_default_pipeline_v1', 'decision', 100, false, 'Decision', 3),
  ('rpts_offer', 'recruitment_default_pipeline_v1', 'offer', 110, false, 'Offer', 5),
  ('rpts_hired', 'recruitment_default_pipeline_v1', 'hired', 120, false, 'Hired', NULL)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "recruitment_settings" (
  "id",
  "default_pipeline_template_id",
  "sla_days_per_stage_json",
  "ai_enabled",
  "require_decision_for_offer",
  "skip_manager_approval_if_no_hm",
  "hm_compensation_visible",
  "allow_duplicate_active_app",
  "metadata",
  "updated_at"
)
VALUES (
  'default',
  'recruitment_default_pipeline_v1',
  '{}',
  true,
  true,
  true,
  true,
  false,
  '{}',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
`;

fs.writeFileSync(path, `${sql.trimEnd()}${extras}`);
console.log("patched", path, "size", fs.statSync(path).size);
