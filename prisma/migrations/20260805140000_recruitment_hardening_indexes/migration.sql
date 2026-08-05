-- Recruitment production hardening: indexes for common filters / joins

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
