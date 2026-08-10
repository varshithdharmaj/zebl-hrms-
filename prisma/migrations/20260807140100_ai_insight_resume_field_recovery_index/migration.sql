-- At most one pending resume_field_recovery insight per candidate.
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_ai_insights_one_pending_recovery_uidx"
  ON "candidate_ai_insights" ("candidate_id")
  WHERE "insight_type" = 'resume_field_recovery' AND "status" = 'pending_review';
