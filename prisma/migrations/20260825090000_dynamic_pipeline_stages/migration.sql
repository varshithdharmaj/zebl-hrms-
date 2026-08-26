-- Phase 1: dynamic pipeline stages — purely additive.
--
-- Does NOT drop or alter "recruitment_applications"."current_stage" or any
-- existing enum column. currentStage (enum) and currentStageId (FK) are
-- both written going forward (see application-service.ts); this migration
-- only adds the new nullable columns/indexes so existing code keeps working
-- unmodified until the repository/service layer is deployed.
--
-- Idempotent throughout (IF NOT EXISTS / duplicate_object guards) so it is
-- safe to re-run against a database that already has some of this via a
-- partial prior attempt.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StageCategory" AS ENUM ('APPLIED', 'SCREENING', 'ASSESSMENT', 'INTERVIEW', 'DECISION', 'OFFER', 'JOINED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: JobOpeningStage — category + isArchived
ALTER TABLE "job_opening_stages" ADD COLUMN IF NOT EXISTS "category" "StageCategory" NOT NULL DEFAULT 'SCREENING';
ALTER TABLE "job_opening_stages" ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Application — currentStageId (nullable FK, additive alongside current_stage)
ALTER TABLE "recruitment_applications" ADD COLUMN IF NOT EXISTS "current_stage_id" TEXT;

-- AlterTable: ApplicationStageHistory — fromStageId / toStageId (nullable FKs, additive)
ALTER TABLE "application_stage_history" ADD COLUMN IF NOT EXISTS "from_stage_id" TEXT;
ALTER TABLE "application_stage_history" ADD COLUMN IF NOT EXISTS "to_stage_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_opening_stages_job_opening_id_sort_order_idx" ON "job_opening_stages"("job_opening_id", "sort_order");
CREATE INDEX IF NOT EXISTS "job_opening_stages_job_opening_id_is_archived_idx" ON "job_opening_stages"("job_opening_id", "is_archived");
CREATE INDEX IF NOT EXISTS "recruitment_applications_current_stage_id_idx" ON "recruitment_applications"("current_stage_id");
CREATE INDEX IF NOT EXISTS "application_stage_history_from_stage_id_idx" ON "application_stage_history"("from_stage_id");
CREATE INDEX IF NOT EXISTS "application_stage_history_to_stage_id_idx" ON "application_stage_history"("to_stage_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_current_stage_id_fkey" FOREIGN KEY ("current_stage_id") REFERENCES "job_opening_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_from_stage_id_fkey" FOREIGN KEY ("from_stage_id") REFERENCES "job_opening_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_to_stage_id_fkey" FOREIGN KEY ("to_stage_id") REFERENCES "job_opening_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
