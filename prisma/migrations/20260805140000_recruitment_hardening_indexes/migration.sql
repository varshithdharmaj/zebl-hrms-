-- Recruitment production hardening: indexes for common filters / joins
--
-- Pre-flight: schema.prisma's Offer model ("Phase 4.2 Offer Management" fields)
-- was never captured in a migration — these columns reached shared dev
-- databases via `prisma db push` drift, not `prisma migrate deploy`, so a
-- genuinely fresh database (e.g. a new AWS RDS instance) fails here with
-- "column does not exist" before it ever reaches CREATE INDEX below.
-- Idempotent (IF NOT EXISTS) so this is a no-op on any database that already
-- has these columns via drift.
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "offer_number" TEXT;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "employment_type" TEXT;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "grade" TEXT;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "reporting_manager_id" INTEGER;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "joining_date" TIMESTAMP(3);
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "ctc" DECIMAL(14,2);
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "salary_breakdown_json" JSONB;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "bonus" DECIMAL(14,2);
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "stock" TEXT;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "probation_days" INTEGER;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "notice_buyout" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "offer_pdf_key" TEXT;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "offer_notes" TEXT;
ALTER TABLE "recruitment_offers" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "recruitment_communications_job_opening_id_created_at_idx"
  ON "recruitment_communications"("job_opening_id", "created_at");

CREATE INDEX IF NOT EXISTS "recruitment_communications_interview_id_idx"
  ON "recruitment_communications"("interview_id");

CREATE INDEX IF NOT EXISTS "recruitment_communications_offer_id_idx"
  ON "recruitment_communications"("offer_id");

CREATE INDEX IF NOT EXISTS "recruitment_offers_department_idx"
  ON "recruitment_offers"("department");

CREATE INDEX IF NOT EXISTS "recruitment_offers_sent_at_idx"
  ON "recruitment_offers"("sent_at");

CREATE INDEX IF NOT EXISTS "recruitment_offers_accepted_at_idx"
  ON "recruitment_offers"("accepted_at");

CREATE INDEX IF NOT EXISTS "recruitment_interviews_status_deleted_at_idx"
  ON "recruitment_interviews"("status", "deleted_at");
